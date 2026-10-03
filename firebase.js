import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');

const here = dirname(fileURLToPath(import.meta.url));

/// The key is a secret, so it lives outside the repository: this looks for it
/// in the folders above. Set SERVICE_ACCOUNT to point somewhere else.
function findKey() {
  if (process.env.SERVICE_ACCOUNT) return resolve(process.env.SERVICE_ACCOUNT);
  const looked = [];
  for (let up = 1; up <= 3; up++) {
    const folder = resolve(here, ...Array(up).fill('..'));
    looked.push(folder);
    const match = readdirSync(folder).find((name) =>
      /firebase-adminsdk.*\.json$/.test(name),
    );
    if (match) return join(folder, match);
  }
  throw new Error(
    `No service account key found in ${looked.join(', ')}. ` +
      'Download it from Firebase console > Project settings > Service accounts, ' +
      'keep it outside this repository, and point SERVICE_ACCOUNT at it.',
  );
}

const keyPath = findKey();
const credentials = JSON.parse(readFileSync(keyPath, 'utf8'));

admin.initializeApp({ credential: admin.credential.cert(credentials) });

export const db = admin.firestore();
export const projectId = credentials.project_id;
export const keyFile = keyPath;
