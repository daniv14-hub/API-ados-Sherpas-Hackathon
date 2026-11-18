// Tests for retention: expired files are deleted.
// Run all tests with: cd agent && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { purgeOlderThan } from '../src/privacy.mjs';

test('purgeOlderThan deletes only what is older than the limit; a missing folder is fine', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'purge-'));
  await fs.writeFile(path.join(dir, 'old.jsonl'), 'x');
  await fs.writeFile(path.join(dir, 'new.jsonl'), 'y');
  const old = new Date(Date.now() - 10 * 86400000);
  await fs.utimes(path.join(dir, 'old.jsonl'), old, old);
  assert.equal(await purgeOlderThan(dir, 7 * 86400000), 1);
  assert.deepEqual(await fs.readdir(dir), ['new.jsonl']);
  assert.equal(await purgeOlderThan(path.join(dir, 'nope'), 1), 0);
});
