import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadProfile, isPhase1Complete, isSafeCaseId } from '../profile.mjs';
import { caseNumbers } from '../numbers.mjs';
import { buildFacts } from './facts.mjs';
import { planScenes } from './scenes.mjs';
import { narrate } from './narrate.mjs';

export class VideoError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'VideoError';
    this.code = code;
  }
}

const VERSION = 1;

// Only what shapes the video goes into the hash. Narration text is generated after the hash is decided.
function hashOf(profile, voice) {
  const used = {
    present: profile.present,
    styles: Object.fromEntries((profile.present ?? []).map((n) => [n, profile.people?.[n]?.style ?? null])),
    main_goal: profile.main_goal?.agreed ?? null,
    top_worry: profile.top_worry?.agreed ?? null,
    detail_level: profile.detail_level ?? null,
  };
  return createHash('sha256').update(JSON.stringify({ profile: used, voice, version: VERSION })).digest('hex').slice(0, 12);
}

export function createVideoBuilder({ source, profilesDir, videosDir, complete, tts, voice, log = console }) {
  const inflight = new Map();

  async function build(caseId) {
    // Unknown adults only matter for a brand-new profile, which is incomplete anyway.
    const profile = await loadProfile(profilesDir, caseId, []);
    if (!isPhase1Complete(profile)) throw new VideoError('profile_incomplete', `profile for ${caseId} is not complete`);

    const dir = path.join(videosDir, `${caseId}-${hashOf(profile, voice)}`);
    const file = path.join(dir, 'video.json');
    try {
      return { video: JSON.parse(await fs.readFile(file, 'utf8')), dir };
    } catch { /* not cached yet */ }

    const [fh, ia, personaMd] = await Promise.all(
      ['financial-health', 'investment-analysis', 'persona'].map((p) => source.getPart(caseId, p)),
    );
    const scenes = planScenes(buildFacts(fh, personaMd), profile);
    const lines = await narrate(scenes, { complete, numberSet: caseNumbers(fh, ia, personaMd), profile, log });

    await fs.mkdir(dir, { recursive: true });
    let failed = false;
    const out = await Promise.all(scenes.map(async (s, i) => {
      const line = lines.find((l) => l.id === s.id);
      let audio = null;
      try {
        const name = `scene-${i}.mp3`;
        await fs.writeFile(path.join(dir, name), await tts(line.text));
        audio = name;
      } catch (e) {
        failed = true;
        log.warn(`tts failed for scene ${s.id}: ${e?.message ?? e}`);
      }
      return { id: s.id, props: s.props, text: line.text, segments: line.segments, audio, duration: null };
    }));

    const video = { caseId, voice, scenes: out };
    if (!failed) {
      const tmp = `${file}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(video, null, 2));
      await fs.rename(tmp, file); // last, so video.json never points at missing audio
    }
    return { video, dir };
  }

  // Server-side only: `dir` holds the scene audio files and must never be sent to the browser.
  function locate(caseId) {
    if (!isSafeCaseId(caseId)) return Promise.reject(new Error(`unsafe caseId: ${caseId}`));
    if (!inflight.has(caseId)) {
      const p = build(caseId).finally(() => inflight.delete(caseId));
      inflight.set(caseId, p);
    }
    return inflight.get(caseId);
  }

  return {
    locate,
    get: (caseId) => locate(caseId).then((r) => r.video),
  };
}
