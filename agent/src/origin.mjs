// WebSocket Origin allow-list: only the page this server serves may open a voice session.
export function isAllowedOrigin(origin, port) {
  return origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`;
}
