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
