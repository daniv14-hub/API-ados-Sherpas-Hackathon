// Data protection helpers (team request 18/11). Retention: old files are deleted when the server starts.
import fs from 'node:fs/promises';
import path from 'node:path';

// Deletes files (and folders) directly inside `dir` whose last change is older than maxAgeMs. Returns how many.
export async function purgeOlderThan(dir, maxAgeMs, { now = Date.now() } = {}) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return 0; }
  let n = 0;
  for (const e of entries) {
    const p = path.join(dir, e.name);
    try {
      const st = await fs.stat(p);
      if (now - st.mtimeMs > maxAgeMs) { await fs.rm(p, { recursive: true, force: true }); n++; }
    } catch { /* already gone */ }
  }
  return n;
}
