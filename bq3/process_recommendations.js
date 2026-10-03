// BQ3: Which regulation tool is the app going to recommend to the user, so it
// can be surfaced first instead of buried in the toolbox?
//
// Turns every recommendation the home screen showed into one CSV row, ready to
// paste into Google Sheets and chart in Looker Studio.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { db, projectId } from '../firebase.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'out');
const BOGOTA_OFFSET_MS = 5 * 3600 * 1000;

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

async function run() {
  const demoUsers = new Set();
  for (const doc of (await db.collection('users').get()).docs) {
    if (doc.data().demo === true) demoUsers.add(doc.id);
  }

  const rows = [];
  for (const doc of (await db.collectionGroup('recommendations').get()).docs) {
    const uid = doc.ref.parent.parent.id;
    const data = doc.data();
    const shownAt = new Date(data.shownAt);
    if (Number.isNaN(shownAt.getTime())) continue;
    rows.push({
      // Bogota has no daylight saving, so one fixed offset is enough.
      date: new Date(shownAt.getTime() - BOGOTA_OFFSET_MS).toISOString().slice(0, 10),
      tool_id: data.toolId ?? '',
      tool_name: data.toolName ?? '',
      strategy: data.strategy ?? '',
      // 1 or 0, so Looker Studio can add them up.
      opened: data.opened === true ? 1 : 0,
      user_id: `u_${uid.slice(-4)}`,
      is_demo: demoUsers.has(uid) || data.demo === true,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.tool_id.localeCompare(b.tool_id));

  const headers = ['date', 'tool_id', 'tool_name', 'strategy', 'opened', 'user_id', 'is_demo'];
  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(',')),
  ].join('\n');

  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, 'bq3_recommendations.csv');
  writeFileSync(file, csv, 'utf8');

  const real = rows.filter((row) => !row.is_demo).length;
  console.log(`Project: ${projectId}`);
  console.log(`${rows.length} recommendations (${real} from real users)`);
  console.log(`Saved to ${file}`);

  // The answer to the business question, to check the report against.
  const byTool = new Map();
  for (const row of rows) {
    const tool = byTool.get(row.tool_name) ?? { shown: 0, opened: 0 };
    tool.shown += 1;
    tool.opened += row.opened;
    byTool.set(row.tool_name, tool);
  }
  console.log('\nMost recommended tools:');
  for (const [name, { shown, opened }] of [...byTool].sort((a, b) => b[1].shown - a[1].shown)) {
    const rate = Math.round((opened / shown) * 100);
    console.log(`  ${name.padEnd(18)} ${String(shown).padStart(4)} shown, ${rate}% opened`);
  }
}

await run();
process.exit(0);
