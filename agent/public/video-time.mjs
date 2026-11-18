// Scene length estimate when there is no audio clip. Shared by the player and the scenes (no import cycle).
const CHARS_PER_SECOND = 14;
export const estimateDuration = (text) => String(text ?? '').length / CHARS_PER_SECOND;
