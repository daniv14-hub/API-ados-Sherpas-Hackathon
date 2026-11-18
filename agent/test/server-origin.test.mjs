// Tests for the Origin and Host allow-lists (only localhost may use the server).
// Run all tests with: cd agent && npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedOrigin } from '../src/origin.mjs';

test('refuses foreign origin', () => {
  assert.equal(isAllowedOrigin('https://evil.example', 5173), false);
  assert.equal(isAllowedOrigin(undefined, 5173), false);
  assert.equal(isAllowedOrigin('http://localhost:9999', 5173), false);
  assert.equal(isAllowedOrigin('http://localhost:5173', 5173), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:5173', 5173), true);
});

test('isAllowedHost: only localhost and 127.0.0.1 on our port', async () => {
  const { isAllowedHost } = await import('../src/origin.mjs');
  assert.equal(isAllowedHost('localhost:5173', 5173), true);
  assert.equal(isAllowedHost('127.0.0.1:5173', 5173), true);
  assert.equal(isAllowedHost('evil.example:5173', 5173), false);
  assert.equal(isAllowedHost('localhost:80', 5173), false);
  assert.equal(isAllowedHost(undefined, 5173), false);
});
