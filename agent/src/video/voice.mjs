// Text-to-speech through the team proxy. Returns a function text -> mp3 Buffer.
export function speech({ baseUrl, key, voice }) {
  return async (text) => {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/audio/speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'eleven-flash-v2.5', voice, input: text }),
    });
    if (!res.ok) throw new Error(`speech failed: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };
}
