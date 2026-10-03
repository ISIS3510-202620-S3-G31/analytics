// Fills Firestore with demo users and their emotion entries, so the weekly
// report has something to show while the app has only a handful of real users.
//
// Everything it writes carries `demo: true`, and `npm run clean` removes it.
import { db, projectId } from './firebase.js';

const WEEKS = 10;
const USERS = 25;
const EMOTIONS = ['happiness', 'sadness', 'fear', 'anger', 'disgust', 'surprise'];
const MOODS = ['calm', 'inspired', 'focused', 'satisfied'];
const TOOLS = ['breathing', 'photo', 'scream', 'tear', 'detective'];

/// Same numbers on every run, so the report does not change under your feet.
let seed = 20261003;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => min + Math.floor(random() * (max - min + 1));

/// Younger users check in more often, and every age group has its own busy
/// weeks, so the question "peak weeks by age" has a real answer.
function activity(ageBucket, weeksAgo) {
  const base = { '17-19': 0.55, '20-22': 0.45, '23-25': 0.3, '26+': 0.2 };
  const busyWeeks = { '17-19': [2, 3], '20-22': [3, 4], '23-25': [5], '26+': [7] };
  const bump = busyWeeks[ageBucket].includes(weeksAgo) ? 0.3 : 0;
  return base[ageBucket] + bump;
}

const bucketOf = (age) =>
  age <= 19 ? '17-19' : age <= 22 ? '20-22' : age <= 25 ? '23-25' : '26+';

/// Midnight of the Monday `weeksAgo` weeks before this week, in Bogota time.
function mondayOf(weeksAgo) {
  const now = new Date();
  const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const bogota = new Date(utcMidnight - 5 * 3600 * 1000);
  const weekday = (bogota.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(utcMidnight - (weekday + weeksAgo * 7) * 86400000);
}

async function seedData() {
  const users = [];
  for (let i = 0; i < USERS; i++) {
    const age = between(17, 31);
    users.push({ uid: `demo_${String(i).padStart(3, '0')}`, age, bucket: bucketOf(age) });
  }

  let checkIns = 0;
  let feedback = 0;
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
      name: `Demo user ${user.uid.slice(-3)}`,
      email: `${user.uid}@example.com`,
      age: user.age,
      demo: true,
    });
    pending++;

    for (let weeksAgo = 0; weeksAgo < WEEKS; weeksAgo++) {
      const monday = mondayOf(weeksAgo);
      for (let day = 0; day < 7; day++) {
        const when = new Date(monday.getTime() + day * 86400000);
        if (when > new Date()) continue;
        if (random() > activity(user.bucket, weeksAgo)) continue;

        // Entries happen during the day in Bogota, not at midnight UTC.
        const at = new Date(when.getTime() + (12 + between(0, 10)) * 3600000);
        const emotions = random() < 0.25
          ? [pick(EMOTIONS), pick(EMOTIONS)]
          : [pick(EMOTIONS)];
        const localDay = new Date(at.getTime() - 5 * 3600 * 1000)
          .toISOString()
          .slice(0, 10);

        batch.set(db.doc(`users/${user.uid}/check_ins/${localDay}`), {
          emotions: [...new Set(emotions)],
          intensity: between(1, 5),
          timestamp: at.toISOString(),
          note: '',
          demo: true,
        });
        checkIns++;
        pending++;

        if (random() < 0.35) {
          batch.set(db.collection(`users/${user.uid}/tool_feedback`).doc(), {
            toolId: pick(TOOLS),
            rating: between(4, 10),
            mood: pick(MOODS),
            startedAt: at.toISOString(),
            durationSeconds: between(60, 600),
            tags: [],
            comment: '',
            favorite: false,
            demo: true,
          });
          feedback++;
          pending++;
        }
        if (pending >= 400) await commit();
      }
    }
  }
  await commit();
  console.log(
    `Seeded ${users.length} demo users, ${checkIns} check-ins and ${feedback} feedback entries in ${projectId}.`,
  );
}

async function clean() {
  let removed = 0;
  const users = await db.collection('users').where('demo', '==', true).get();
  for (const user of users.docs) {
    for (const name of ['check_ins', 'tool_feedback']) {
      const docs = await user.ref.collection(name).get();
      for (const doc of docs.docs) {
        await doc.ref.delete();
        removed++;
      }
    }
    await user.ref.delete();
    removed++;
  }
  console.log(`Removed ${removed} demo documents from ${projectId}.`);
}

const isClean = process.argv.includes('--clean');
await (isClean ? clean() : seedData());
process.exit(0);
