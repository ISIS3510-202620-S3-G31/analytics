// Fills Firestore with demo recommendations, shaped exactly like the ones the
// Flutter home screen saves in `users/{uid}/recommendations`, so the BQ3 report
// has something to show while the app has only a handful of real users.
//
// Everything it writes carries `demo: true`, and `npm run clean:bq3` removes it.
import { db, projectId } from '../firebase.js';

const DAYS = 28;
const USERS = 20;

/// Category of each tool, as in tool_repository.dart.
const TOOL_CATEGORY = {
  breathing: 'calm down',
  photo: 'reflect',
  scream: 'release',
  tear: 'release',
  detective: 'reflect',
};

const TOOL_NAMES = {
  breathing: 'Custom breathing',
  photo: 'Photo of the day',
  scream: 'Scream tank',
  tear: 'Tear it up',
  detective: 'Thought detective',
};

/// Same table as MoodBasedStrategy in the app: the first tool for each emotion.
const TOOL_FOR_EMOTION = {
  anger: 'scream',
  disgust: 'tear',
  fear: 'breathing',
  sadness: 'detective',
  happiness: 'photo',
  surprise: 'photo',
};
const EMOTIONS = Object.keys(TOOL_FOR_EMOTION);

/// How often the user taps the card, by strategy.
const OPEN_CHANCE = { 'Mood based': 0.6, 'Frequency based': 0.45, Default: 0.3 };

/// Same numbers on every run, so the report does not change under your feet.
let seed = 20261003;
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => min + Math.floor(random() * (max - min + 1));

/// Picks the tool the way ToolRecommender does: the last check-in first, then
/// the tool the user finished the most, and the starter tool otherwise.
function recommend(checkedInToday, uses) {
  if (checkedInToday) {
    const emotion = pick(EMOTIONS);
    return {
      toolId: TOOL_FOR_EMOTION[emotion],
      strategy: 'Mood based',
      reason: `You felt ${emotion} in your last check-in.`,
    };
  }
  const total = Object.values(uses).reduce((sum, count) => sum + count, 0);
  if (total >= 3) {
    const favorite = Object.entries(uses).sort((a, b) => b[1] - a[1])[0][0];
    return {
      toolId: favorite,
      strategy: 'Frequency based',
      reason: `You often choose ${TOOL_CATEGORY[favorite]} tools.`,
    };
  }
  return { toolId: 'breathing', strategy: 'Default', reason: 'A gentle place to start.' };
}

async function seedData() {
  let recommendations = 0;
  let batch = db.batch();
  let pending = 0;

  const commit = async () => {
    if (pending === 0) return;
    await batch.commit();
    batch = db.batch();
    pending = 0;
  };

  for (let i = 0; i < USERS; i++) {
    const uid = `demo_rec_${String(i).padStart(3, '0')}`;
    batch.set(db.doc(`users/${uid}`), {
      name: `Demo user ${uid.slice(-3)}`,
      email: `${uid}@example.com`,
      age: between(18, 30),
      demo: true,
    });
    pending++;

    const uses = {};
    for (let daysAgo = DAYS - 1; daysAgo >= 0; daysAgo--) {
      // Not everybody opens the app every day.
      if (random() > 0.6) continue;

      // Opened during the day in Bogota (UTC-5), not at midnight UTC.
      const day = new Date(Date.now() - daysAgo * 86400000);
      const shownAt = new Date(
        Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12 + between(0, 10)),
      );
      if (shownAt > new Date()) continue;

      const choice = recommend(random() < 0.45, uses);
      const opened = random() < OPEN_CHANCE[choice.strategy];

      batch.set(db.collection(`users/${uid}/recommendations`).doc(), {
        toolId: choice.toolId,
        toolName: TOOL_NAMES[choice.toolId],
        strategy: choice.strategy,
        reason: choice.reason,
        shownAt: shownAt.toISOString(),
        opened,
        ...(opened && { openedAt: new Date(shownAt.getTime() + 20000).toISOString() }),
        demo: true,
      });
      recommendations++;
      pending++;

      // Opening the tool makes it more likely to be recommended again.
      if (opened) uses[choice.toolId] = (uses[choice.toolId] ?? 0) + 1;

      if (pending >= 400) await commit();
    }
  }

  await commit();
  console.log(`Project: ${projectId}`);
  console.log(`Created ${USERS} demo users and ${recommendations} recommendations.`);
}

/// Removes only what this script wrote: the demo recommendations and the
/// demo_rec_ users, never the demo data of the other questions.
async function clean() {
  let removed = 0;
  for (const doc of (await db.collectionGroup('recommendations').get()).docs) {
    if (doc.data().demo !== true) continue;
    await doc.ref.delete();
    removed++;
  }
  for (const user of (await db.collection('users').get()).docs) {
    if (!user.id.startsWith('demo_rec_')) continue;
    await user.ref.delete();
    removed++;
  }
  console.log(`Project: ${projectId}`);
  console.log(`Removed ${removed} demo documents.`);
}

await (process.argv.includes('--clean') ? clean() : seedData());
process.exit(0);
