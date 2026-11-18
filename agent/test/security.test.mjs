import { test } from 'node:test';
import assert from 'node:assert/strict';
import { securityHeaders, createRateLimiter, ALLOWED_METHODS } from '../src/security.mjs';

test('security headers: strict CSP (self + Google Fonts), no sniffing, same-origin framing, mic for self only', () => {
  const h = securityHeaders(5173);
  const csp = h['Content-Security-Policy'];
  for (const part of ["default-src 'self'", "object-src 'none'", "base-uri 'none'", "frame-ancestors 'self'", "form-action 'none'",
    'connect-src \'self\' ws://localhost:5173 ws://127.0.0.1:5173', 'font-src \'self\' https://fonts.gstatic.com']) assert.ok(csp.includes(part), part);
  assert.doesNotMatch(csp, /\*/);
  assert.equal(h['X-Content-Type-Options'], 'nosniff');
  assert.equal(h['X-Frame-Options'], 'SAMEORIGIN');
  assert.equal(h['Referrer-Policy'], 'no-referrer');
  assert.match(h['Permissions-Policy'], /microphone=\(self\)/);
  assert.match(h['Permissions-Policy'], /camera=\(\)/);
  assert.equal(h['Cross-Origin-Opener-Policy'], 'same-origin');
  assert.deepEqual([...ALLOWED_METHODS].sort(), ['GET', 'HEAD']);
});

test('rate limiter: allows up to the limit per window and key, then refuses until the window passes', () => {
  let t = 0;
  const rl = createRateLimiter({ limit: 3, windowMs: 1000, now: () => t });
  assert.deepEqual([rl.hit('a'), rl.hit('a'), rl.hit('a'), rl.hit('a')], [true, true, true, false]);
  assert.equal(rl.hit('b'), true); // keys are independent
  t = 999; assert.equal(rl.hit('a'), false);
  t = 1000; assert.equal(rl.hit('a'), true);
});
