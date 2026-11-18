import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChatMemory } from '../src/chat-memory.mjs';

test('keeps the last lines per case and forgets them after the ttl', () => {
  let t = 0;
  const m = createChatMemory({ ttlMs: 1000, maxLines: 3, now: () => t });
  assert.deepEqual(m.get('a'), []);
  for (const x of ['1', '2', '3', '4']) m.add('a', 'user', x);
  m.add('a', 'assistant', '   ');
  assert.deepEqual(m.get('a').map((l) => l.text), ['2', '3', '4']);
  assert.deepEqual(m.get('b'), []);
  t = 999; assert.equal(m.get('a').length, 3);
  t = 2000; assert.deepEqual(m.get('a'), []);
});
