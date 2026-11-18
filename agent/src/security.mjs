// Security layers for the local server (team request 18/11): response headers, allowed methods, rate limits.
// The server only listens on 127.0.0.1 and checks Host and Origin (origin.mjs); these are extra layers.

export const ALLOWED_METHODS = new Set(['GET', 'HEAD']);

// Headers for every response. Pages load only our own files, plus Google Fonts (video page) as the one exception.
// Inline scripts/styles are allowed because the pages use small inline blocks; external scripts are not.
export function securityHeaders(port) {
  const ws = `ws://localhost:${port} ws://127.0.0.1:${port}`;
  return {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      `connect-src 'self' ${ws}`,
      "frame-src 'self'",
      "frame-ancestors 'self'",
      "worker-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'microphone=(self), camera=(), geolocation=(), payment=(), usb=(), autoplay=(self)',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
}

// Fixed-window counter per key: hit(key) -> true while under `limit` in the current window.
export function createRateLimiter({ limit, windowMs, now = Date.now }) {
  const windows = new Map(); // key -> { start, count }
  return {
    hit(key) {
      const t = now();
      let w = windows.get(key);
      if (!w || t - w.start >= windowMs) {
        w = { start: t, count: 0 };
        windows.set(key, w);
        if (windows.size > 1000) for (const [k, v] of windows) if (t - v.start >= windowMs) windows.delete(k);
      }
      w.count++;
      return w.count <= limit;
    },
  };
}
