// Script para poblar Firestore con check-ins que incluyen latitude y longitude en Bogotá.
// Respeta exactamente la estructura del proyecto y marca los datos con `demo: true`.
import { db, projectId } from '../firebase.js';

const WEEKS = 4;
const USERS = 15;
const EMOTIONS = ['happiness', 'sadness', 'fear', 'anger', 'disgust', 'surprise'];

// Coordenadas representativas por localidad de Bogotá para la simulación
const BOGOTA_COORDS = [
  { name: 'Usaquén', minLat: 4.70, maxLat: 4.76, minLng: -74.05, maxLng: -74.02 },
  { name: 'Suba', minLat: 4.71, maxLat: 4.76, minLng: -74.12, maxLng: -74.07 },
  { name: 'Chapinero', minLat: 4.65, maxLat: 4.68, minLng: -74.06, maxLng: -74.03 },
  { name: 'Teusaquillo', minLat: 4.63, maxLat: 4.65, minLng: -74.09, maxLng: -74.07 },
  { name: 'Engativá', minLat: 4.69, maxLat: 4.71, minLng: -74.12, maxLng: -74.09 },
  { name: 'Fontibón', minLat: 4.67, maxLat: 4.68, minLng: -74.14, maxLng: -74.11 },
  { name: 'Kennedy', minLat: 4.61, maxLat: 4.65, minLng: -74.16, maxLng: -74.14 },
  { name: 'Santa Fe', minLat: 4.59, maxLat: 4.60, minLng: -74.07, maxLng: -74.06 },
  { name: 'Bosa', minLat: 4.60, maxLat: 4.63, minLng: -74.19, maxLng: -74.17 },
  { name: 'Ciudad Bolívar', minLat: 4.50, maxLat: 4.56, minLng: -74.16, maxLng: -74.13 }
];

let seed = 20261003;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => min + Math.floor(random() * (max - min + 1));
const randomFloat = (min, max) => min + random() * (max - min);

function mondayOf(weeksAgo) {
  const now = new Date();
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const bogota = new Date(utcMidnight - 5 * 3600 * 1000);
  const weekday = (bogota.getUTCDay() + 6) % 7;
  return new Date(utcMidnight - (weekday + weeksAgo * 7) * 86400000);
}

async function seedLocationData() {
  console.log(` Poblando Firestore (${projectId}) con check-ins y coordenadas en Bogotá...`);
  
  const users = [];
  for (let i = 0; i < USERS; i++) {
    users.push({ uid: `demo_loc_${String(i).padStart(3, '0')}` });
  }

  let checkIns = 0;
  let batch = db.batch();
  let pending = 0;

  const commit = async () => {
    if (pending === 0) return;
    await batch.commit();
    batch = db.batch();
    pending = 0;
  };

  for (const user of users) {
    batch.set(db.doc(`users/${user.uid}`), {
      name: `Demo User ${user.uid.slice(-3)}`,
      email: `${user.uid}@example.com`,
      age: between(18, 35),
      demo: true,
    });
    pending++;

    // Asignar 1 o 2 localidades frecuentes por usuario para simular patrones reales
    const userLocality1 = pick(BOGOTA_COORDS);
    const userLocality2 = pick(BOGOTA_COORDS);

    for (let weeksAgo = 0; weeksAgo < WEEKS; weeksAgo++) {
      const monday = mondayOf(weeksAgo);
      for (let day = 0; day < 7; day++) {
        const when = new Date(monday.getTime() + day * 86400000);
        if (when > new Date()) continue;
        if (random() > 0.5) continue; // Probabilidad de check-in

        const at = new Date(when.getTime() + (10 + between(0, 10)) * 3600000);
        const emotions = random() < 0.3
          ? [pick(EMOTIONS), pick(EMOTIONS)]
          : [pick(EMOTIONS)];

        const localDay = new Date(at.getTime() - 5 * 3600 * 1000)
          .toISOString()
          .slice(0, 10);

        // Elegir localidad y generar lat/lng exactos dentro de la localidad
        const locSpec = random() < 0.7 ? userLocality1 : userLocality2;
        const latitude = Number(randomFloat(locSpec.minLat, locSpec.maxLat).toFixed(6));
        const longitude = Number(randomFloat(locSpec.minLng, locSpec.maxLng).toFixed(6));

        batch.set(db.doc(`users/${user.uid}/check_ins/${localDay}`), {
          emotions: [...new Set(emotions)],
          intensity: between(1, 5),
          latitude,
          longitude,
          timestamp: at.toISOString(),
          note: `Check-in en ${locSpec.name}`,
          demo: true,
        });
        checkIns++;
        pending++;

        if (pending >= 400) await commit();
      }
    }
  }

  await commit();
  console.log(` Creados ${users.length} usuarios demo y ${checkIns} check-ins con latitud/longitud en Firestore.`);
}

async function clean() {
  console.log(` Limpiando usuarios demo de ubicación en ${projectId}...`);
  let removed = 0;
  const users = await db.collection('users').where('demo', '==', true).get();
  for (const user of users.docs) {
    const checkIns = await user.ref.collection('check_ins').get();
    for (const doc of checkIns.docs) {
      await doc.ref.delete();
      removed++;
    }
    await user.ref.delete();
    removed++;
  }
  console.log(` Se eliminaron ${removed} documentos demo.`);
}

const isClean = process.argv.includes('--clean');
await (isClean ? clean() : seedLocationData());
process.exit(0);
