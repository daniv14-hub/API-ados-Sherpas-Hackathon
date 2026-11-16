import test from "node:test";
import assert from "node:assert/strict";
import { createCaseSource, CaseSourceError } from "../src/case-source.mjs";

const reply = (text) => ({ content: [{ text }] });

test("getPart parses value of a JSON part", async () => {
  const callTool = async () =>
    reply(JSON.stringify({ id: "x", part: "financial-health", section: "score", value: { published_score: 52 } }));
  const src = createCaseSource({ callTool });
  assert.deepEqual(await src.getPart("x", "financial-health", "score"), { published_score: 52 });
});

test("getPart returns whole JSON part when there is no value wrapper", async () => {
  const body = { schema_version: 2, part: "financial-health", case: { slug: "x" } };
  const src = createCaseSource({ callTool: async () => reply(JSON.stringify(body)) });
  assert.deepEqual(await src.getPart("x", "financial-health"), body);
});

test("getPart returns persona markdown as text", async () => {
  const md = "# Household Persona: Daniel and Emily\n\n## D0: Wealth tier\n";
  const src = createCaseSource({ callTool: async () => reply(md) });
  assert.equal(await src.getPart("x", "persona"), md);
});

test("getPart returns persona section markdown from value", async () => {
  const md = "## D4: Risk orientation\n\n- **D4a stated:** ...";
  const src = createCaseSource({
    callTool: async () => reply(JSON.stringify({ id: "x", part: "persona", section: "D4: Risk orientation", value: md })),
  });
  assert.equal(await src.getPart("x", "persona", "D4"), md);
});

test("getPart passes caseId, part and section to callTool", async () => {
  const calls = [];
  const src = createCaseSource({ callTool: async (n, a) => (calls.push([n, a]), reply("{}")) });
  await src.getPart("x", "persona", "D4");
  await src.getPart("x", "persona");
  assert.deepEqual(calls, [
    ["get_case", { caseId: "x", part: "persona", section: "D4" }],
    ["get_case", { caseId: "x", part: "persona" }],
  ]);
});

test("getPart wraps transport errors in CaseSourceError", async () => {
  const src = createCaseSource({ callTool: async () => { throw new Error("401"); } });
  await assert.rejects(src.getPart("x", "persona"), CaseSourceError);
});

test("getPart wraps malformed responses in CaseSourceError", async () => {
  const src = createCaseSource({ callTool: async () => ({}) });
  await assert.rejects(src.getPart("x", "persona"), CaseSourceError);
});

test("listCaseIds returns case ids", async () => {
  const callTool = async (name, args) => {
    assert.equal(name, "list_cases");
    assert.deepEqual(args, {});
    return reply(JSON.stringify([
      { id: "daniel-emily-johnson", household: [{ first_name: "Daniel" }] },
      { id: "michael-carter", household: [] },
    ]));
  };
  const src = createCaseSource({ callTool });
  assert.deepEqual(await src.listCaseIds(), ["daniel-emily-johnson", "michael-carter"]);
});

test("getPart throws CaseSourceError when the MCP reply has isError", async () => {
  const src = createCaseSource({ callTool: async () => ({ isError: true, content: [{ text: "case not found" }] }) });
  await assert.rejects(src.getPart("x", "persona"), CaseSourceError);
});

test("withReconnect retries once after a transport error", async () => {
  const { withReconnect } = await import("../src/case-source.mjs");
  let connects = 0;
  const closed = [];
  const w = withReconnect(async () => {
    const n = ++connects;
    return {
      callTool: async () => {
        if (n === 1) throw new Error("transport down");
        return reply("ok");
      },
      close: async () => closed.push(n),
    };
  });
  assert.deepEqual(await w.callTool("get_case", {}), reply("ok"));
  assert.equal(connects, 2);
  assert.deepEqual(closed, [1]);
});

test("withReconnect throws after a second failure", async () => {
  const { withReconnect } = await import("../src/case-source.mjs");
  let connects = 0;
  const w = withReconnect(async () => {
    connects++;
    return { callTool: async () => { throw new Error("still down"); }, close: async () => {} };
  });
  await assert.rejects(() => w.callTool("get_case", {}), /still down/);
  assert.equal(connects, 2);
});
