// WebSocket Origin allow-list: only the page this server serves may open a voice session.
export function isAllowedOrigin(origin, port) {
  return origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`;
}

// Host allow-list for every HTTP request: a page on another domain that re-points its DNS to 127.0.0.1
// (DNS rebinding) still sends its own Host header, so it is refused (security review 18/11, hardening).
export function isAllowedHost(host, port) {
  return host === `localhost:${port}` || host === `127.0.0.1:${port}`;
}
