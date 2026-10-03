# Emotion entries by week and age

Answers: *What are the peak weeks for emotion entries across the calendar,
segmented by age?*

Firestore → `export.js` → CSV → Google Sheets → Looker Studio.

The data comes from the Flutter app (`frontend-flutter`), which writes the
check-ins and tool feedback this reads.

## Before running

The service account key is a secret and must stay **outside this repository**.
Keep it in one of the folders above this one, or set `SERVICE_ACCOUNT` to its
path. `.gitignore` blocks `*-firebase-adminsdk-*.json` as a second guard.

```
npm install
```

## Commands

| Command | What it does |
|---|---|
| `npm run export` | Writes `out/emotion_entries.csv` and prints the peak week per age group |
| `npm run seed` | Adds 25 demo users with 10 weeks of entries, all marked `demo: true` |
| `npm run clean` | Deletes everything that `seed` created |

## What one row means

One row per **emotion reported**: a check-in with two emotions becomes two
rows, and the mood picked after using a tool counts as well (`source` says
which one it was).

| Column | Notes |
|---|---|
| `week` | ISO week as `2026-W37`; sorting this text sorts the weeks |
| `week_start` | Monday of that week |
| `date`, `age`, `emotion`, `intensity` | as reported |
| `age_bucket` | 17-19, 20-22, 23-25, 26+, Unknown |
| `source` | `check_in` or `tool_feedback` |
| `user_id` | shortened, to count distinct users |
| `is_demo` | true for seeded rows |

Timestamps are stored in UTC and converted to Bogota time before the week is
calculated. Without that, an entry made after 7pm would land in the next day,
and sometimes in the next week.

## Building the report

1. Open `out/emotion_entries.csv` in Google Sheets (File → Import → Upload,
   "Replace current sheet").
2. In Looker Studio: Create → Report → Google Sheets → pick that sheet.
3. Add a **stacked column chart**: dimension `week`, breakdown `age_bucket`,
   metric `Record Count`, sorted by `week` ascending.
4. Add a **table**: dimensions `age_bucket` and `week`, metric `Record Count`,
   sorted descending — the first row of each group is its peak week.
5. Add filter controls for `emotion`, `age_bucket` and `is_demo`.
6. Write on the page that part of the data is simulated, and say how much:
   `export.js` prints how many rows come from real users.

## Two things to keep in mind when reading the chart

- **The current week is partial.** It only holds the days up to today, so it
  always looks like a dip.
- **Raw counts favour the bigger age group.** If one group has 12 users and
  another 3, the first one wins every week. For a fair comparison divide by
  the number of distinct users in the group.
