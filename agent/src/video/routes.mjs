import { isAllowedCase } from '../session.mjs';

const VIDEO_RE = /^\/video\/([^/]+)(?:\/audio\/(\d+)\.mp3)?$/;

// '/video/<case>' -> { caseId, audio: null }; '/video/<case>/audio/<i>.mp3' -> { caseId, audio: i }; anything else -> null.
// The upper bound of the audio index depends on the built video, so the route checks it.
export function parseVideoPath(pathname, caseIds) {
  const m = VIDEO_RE.exec(pathname);
  if (!m || !isAllowedCase(m[1], caseIds)) return null;
  return { caseId: m[1], audio: m[2] === undefined ? null : Number(m[2]) };
}

// What the browser gets: audio as a URL, never a file name or path.
export function videoView(video) {
  return {
    caseId: video.caseId,
    voice: video.voice,
    scenes: video.scenes.map((s, i) => ({
      id: s.id,
      props: s.props,
      text: s.text,
      segments: s.segments,
      audio: s.audio ? `/video/${video.caseId}/audio/${i}.mp3` : null,
      duration: s.duration,
    })),
  };
}
