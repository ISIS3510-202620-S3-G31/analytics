import { writeFileSync, mkdirSync } from 'node:fs';
import { db } from '../firebase.js';

// Coordenadas aproximadas de las localidades de Bogotá
const BOGOTA_LOCALITIES = [
  { name: 'Usaquén', minLat: 4.69, maxLat: 4.80, minLng: -74.06, maxLng: -74.01 },
  { name: 'Suba', minLat: 4.70, maxLat: 4.78, minLng: -74.14, maxLng: -74.06 },
  { name: 'Chapinero', minLat: 4.64, maxLat: 4.69, minLng: -74.07, maxLng: -74.02 },
  { name: 'Teusaquillo', minLat: 4.62, maxLat: 4.66, minLng: -74.09, maxLng: -74.07 },
  { name: 'Engativá', minLat: 4.68, maxLat: 4.72, minLng: -74.13, maxLng: -74.08 },
  { name: 'Fontibón', minLat: 4.66, maxLat: 4.69, minLng: -74.15, maxLng: -74.10 },
  { name: 'Kennedy', minLat: 4.60, maxLat: 4.66, minLng: -74.17, maxLng: -74.13 },
  { name: 'Santa Fe', minLat: 4.58, maxLat: 4.61, minLng: -74.08, maxLng: -74.06 },
  { name: 'Bosa', minLat: 4.59, maxLat: 4.64, minLng: -74.20, maxLng: -74.17 },
  { name: 'Ciudad Bolívar', minLat: 4.48, maxLat: 4.58, minLng: -74.17, maxLng: -74.12 }
];

/**
 * Convierte latitud y longitud a nombre de localidad
 */
function coordsToLocality(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return 'Ubicación no especificada';
  
  for (const loc of BOGOTA_LOCALITIES) {
    if (lat >= loc.minLat && lat <= loc.maxLat && lng >= loc.minLng && lng <= loc.maxLng) {
      return loc.name;
    }
  }
  return 'Otra localidad';
}

async function runComputation() {
  console.log('Consultando check-ins en Firestore...');
  const snapshot = await db.collectionGroup('check_ins').get();
  
  const rawEntries = [];
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    
    // Soporta lat/lng directos, objetos location y GeoPoints de Firestore
    const lat = data.latitude ?? data.lat ?? data.location?.latitude ?? data.location?._latitude;
    const lng = data.longitude ?? data.lng ?? data.location?.longitude ?? data.location?._longitude;
    
    // Clasificar coordenadas a localidad de Bogotá
    const locality = coordsToLocality(lat, lng);
    const intensity = Number(data.intensity) || 0;
    const emotions = Array.isArray(data.emotions) ? data.emotions : [];

    // Desanidar cada emoción
    emotions.forEach(emotion => {
      rawEntries.push({
        locality,
        emotion,
        intensity,
        timestamp: data.timestamp
      });
    });
  });

  console.log(` Procesando ${rawEntries.length} entradas desanidadas...`);

  // Agrupar por (localidad + emoción)
  const grouped = new Map();
  rawEntries.forEach(({ locality, emotion, intensity }) => {
    const key = `${locality}|${emotion}`;
    if (!grouped.has(key)) {
      grouped.set(key, { locality, emotion, count: 0, sumIntensity: 0 });
    }
    const current = grouped.get(key);
    current.count += 1;
    current.sumIntensity += intensity;
  });

  // Organizar por localidad
  const localityMap = new Map();
  grouped.forEach(({ locality, emotion, count, sumIntensity }) => {
    if (!localityMap.has(locality)) {
      localityMap.set(locality, []);
    }
    const avgIntensity = Number((sumIntensity / count).toFixed(2));
    localityMap.get(locality).push({ emotion, count, avgIntensity });
  });

  // Generar filas para el reporte final de Looker Studio
  const summaryRows = [];
  localityMap.forEach((emotionsList, locality) => {
    const totalCheckIns = emotionsList.reduce((acc, e) => acc + e.count, 0);
    
    // 1. Emoción más frecuente (mayor conteo)
    const mostFrequent = [...emotionsList].sort((a, b) => b.count - a.count)[0];
    
    // 2. Emoción con mayor intensidad promedio
    const highestIntensity = [...emotionsList].sort((a, b) => b.avgIntensity - a.avgIntensity)[0];

    summaryRows.push({
      locality,
      total_checkins: totalCheckIns,
      most_frequent_emotion: mostFrequent?.emotion ?? 'N/A',
      most_frequent_count: mostFrequent?.count ?? 0,
      highest_intensity_emotion: highestIntensity?.emotion ?? 'N/A',
      highest_avg_intensity: highestIntensity?.avgIntensity ?? 0
    });
  });

  // Exportar a CSV
  mkdirSync('./out', { recursive: true });
  const headers = [
    'locality', 
    'total_checkins', 
    'most_frequent_emotion', 
    'most_frequent_count', 
    'highest_intensity_emotion', 
    'highest_avg_intensity'
  ];
  
  const csvLines = [
    headers.join(','),
    ...summaryRows.map(r => 
      `"${r.locality}",${r.total_checkins},"${r.most_frequent_emotion}",${r.most_frequent_count},"${r.highest_intensity_emotion}",${r.highest_avg_intensity}`
    )
  ].join('\n');

  const file = './out/locality_emotions_summary.csv';
  writeFileSync(file, csvLines, 'utf8');

  console.log(` CSV generado exitosamente en: ${file}`);
  console.table(summaryRows);
}

await runComputation();
process.exit(0);