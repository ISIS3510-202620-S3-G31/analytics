// Flattens every emotion entry in Firestore into one CSV row, ready to paste
// into Google Sheets and chart in Looker Studio.
//
// One row per emotion: a check-in with two emotions becomes two rows.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { db, projectId } from './firebase.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out');
const BOGOTA_OFFSET_MS = 5 * 3600 * 1000;

const bucketOf = (age) => {
  // Test accounts carry ages like 1, which would land in the youngest group.
  if (age == null || age < 15 || age > 90) return 'Unknown';
  if (age <= 19) return '17-19';
  if (age <= 22) return '20-22';
  if (age <= 25) return '23-25';
  return '26+';
};

/// Bogota has no daylight saving, so one fixed offset is enough.
const toBogota = (iso) => new Date(new Date(iso).getTime() - BOGOTA_OFFSET_MS);

/// ISO week, written as 2026-W40 so that sorting the text sorts the weeks.
function isoWeek(date) {
  const thursday = new Date(date.getTime());
  thursday.setUTCDate(thursday.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      (thursday - firstThursday) / 86400000 / 7 -
        ((firstThursday.getUTCDay() + 6) % 7) / 7,
    );
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/// Monday of that week, as yyyy-mm-dd.
function weekStart(date) {
  const monday = new Date(date.getTime());
  monday.setUTCDate(monday.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

async function run() {
  const users = new Map();
  for (const doc of (await db.collection('users').get()).docs) {
    const data = doc.data();
    users.set(doc.id, {
      age: typeof data.age === 'number' ? data.age : null,
      demo: data.demo === true,
    });
  }

  const rows = [];
  const add = (uid, iso, source, emotion, intensity) => {
    if (!iso) return;
    const local = toBogota(iso);
    if (Number.isNaN(local.getTime())) return;
    const user = users.get(uid) ?? { age: null, demo: false };
    rows.push({
      week: isoWeek(local),
      week_start: weekStart(local),
      date: local.toISOString().slice(0, 10),
      age: user.age ?? '',
      age_bucket: bucketOf(user.age),
      emotion,
      intensity,
      source,
      user_id: `u_${uid.slice(-4)}`,
      is_demo: user.demo,
    });
  };

  for (const doc of (await db.collectionGroup('check_ins').get()).docs) {
    const uid = doc.ref.parent.parent.id;
    const data = doc.data();
    for (const emotion of data.emotions ?? []) {
      add(uid, data.timestamp, 'check_in', emotion, data.intensity ?? '');
    }
  }

  for (const doc of (await db.collectionGroup('tool_feedback').get()).docs) {
    const uid = doc.ref.parent.parent.id;
    const data = doc.data();
    // The feedback mood is an emotion the user reported too, just after a tool.
    add(uid, data.startedAt, 'tool_feedback', data.mood ?? '', data.rating ?? '');
  }

  rows.sort((a, b) => a.week.localeCompare(b.week) || a.date.localeCompare(b.date));

  const headers = Object.keys(rows[0] ?? { week: '' });
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(',')),
  ].join('\n');

  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, 'emotion_entries.csv');
  writeFileSync(file, csv, 'utf8');

  const weeks = new Set(rows.map((row) => row.week));
  const real = rows.filter((row) => !row.is_demo).length;
  console.log(`Project: ${projectId}`);
  console.log(`${rows.length} rows (${real} from real users) across ${weeks.size} weeks`);
  console.log(`Saved to ${file}`);

  // The answer to the business question, to check the report against.
  const counts = new Map();
  for (const row of rows) {
    const key = `${row.age_bucket}|${row.week}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const peaks = new Map();
  for (const [key, total] of counts) {
    const [bucket, week] = key.split('|');
    const best = peaks.get(bucket);
    if (!best || total > best.total) peaks.set(bucket, { week, total });
  }
  console.log('\nPeak week per age group:');
  for (const bucket of ['17-19', '20-22', '23-25', '26+', 'Unknown']) {
    const peak = peaks.get(bucket);
    if (peak) console.log(`  ${bucket.padEnd(8)} ${peak.week}  (${peak.total} entries)`);
  }
}

await run();
process.exit(0);
