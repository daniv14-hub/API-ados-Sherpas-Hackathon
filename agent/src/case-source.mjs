// Where the case data comes from. Two sources with the same interface { getPart, listCaseIds }:
//   - createCaseSource(mcp): the official Sherpas MCP server (needs MCP_URL + MCP_TOKEN, token lasts 72 h).
//   - createLocalCaseSource(dir): the same JSON files from the repo's cases/ folder (never expire).
// Parts: 'financial-health' (JSON), 'investment-analysis' (JSON), 'persona' (Markdown text).
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// Error type for any failure reading case data; callers log it without exposing tokens or data.
export class CaseSourceError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "CaseSourceError";
  }
}

// Real MCP response shapes (recorded with scripts/mcp-smoke.mjs):
//  - list_cases {}: text is a JSON array: [{ id, household: [...], ... }]
//  - get_case with section on a JSON part: JSON { id, part, section, value: <object> }
//  - get_case on a JSON part without section: JSON with NO `value` wrapper
//    ({ schema_version, part, case: {...}, ... }) -> returned whole
//  - get_case persona with section (e.g. D4): JSON { id, part, section, value: "<markdown string>" }
//  - get_case persona without section: raw Markdown text (NOT JSON, starts with "# Household Persona")
function extractText(res) {
  const text = res?.content?.[0]?.text;
  if (res?.isError) throw new CaseSourceError(`MCP tool error: ${typeof text === "string" ? text : "(no text)"}`);
  if (typeof text !== "string") throw new CaseSourceError("MCP response has no text content");
  return text;
}

// MCP-backed source: calls the MCP tools get_case / list_cases and unwraps their JSON text.
export function createCaseSource({ callTool }) {
  async function call(name, args) {
    try {
      return extractText(await callTool(name, args));
    } catch (err) {
      if (err instanceof CaseSourceError) throw err;
      throw new CaseSourceError(`MCP call ${name} failed: ${err.message}`, { cause: err });
    }
  }

  return {
    async getPart(caseId, part, section) {
      const args = { caseId, part };
      if (section !== undefined) args.section = section;
      const text = await call("get_case", args);
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        return text; // persona without section: Markdown
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "value" in parsed) {
        return parsed.value;
      }
      return parsed;
    },

    async listCaseIds() {
      const text = await call("list_cases", {});
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new CaseSourceError("list_cases returned non-JSON", { cause: err });
      }
      if (!Array.isArray(parsed)) throw new CaseSourceError("list_cases did not return an array");
      return parsed.map((c) => c.id);
    },
  };
}

// Opens an authenticated MCP client over Streamable HTTP (token sent as a Bearer header).
export async function connectMcp(url, token) {
  const mcp = new Client({ name: "sherpy-agent", version: "1.0.0" });
  await mcp.connect(new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  }));
  return {
    callTool: (name, args) => mcp.callTool({ name, arguments: args }),
    close: () => mcp.close(),
  };
}

// Wraps a connect function so a transport error triggers one reconnect and one retry.
// A second failure is thrown to the caller (case-source turns it into CaseSourceError).
export function withReconnect(connect) {
  let current = null;
  const get = async () => (current ??= await connect());
  return {
    async callTool(name, args) {
      try {
        return await (await get()).callTool(name, args);
      } catch {
        const old = current;
        current = null;
        await old?.close().catch(() => {});
        return (await get()).callTool(name, args);
      }
    },
    async close() {
      const old = current;
      current = null;
      await old?.close();
    },
  };
}

// Same interface, read from the repo's cases/ folder (the JSON the MCP serves). Used when no MCP token is set:
// the token is personal and lasts 72 h, the files never expire (hackathon README), so judges can run the app later.
const PARTS = { 'financial-health': 'financial-health.json', 'investment-analysis': 'investment-analysis.json', persona: 'persona.md' };
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createLocalCaseSource(dirUrl) {
  const dir = dirUrl instanceof URL ? dirUrl : pathToFileURL(`${dirUrl}/`);
  return {
    async getPart(caseId, part, section) {
      if (!SAFE_ID.test(String(caseId)) || !Object.hasOwn(PARTS, part)) throw new CaseSourceError(`unknown case part: ${part}`);
      const text = await readFile(new URL(`${caseId}/${PARTS[part]}`, dir), 'utf8');
      if (part === 'persona') return text;
      const data = JSON.parse(text);
      return section === undefined ? data : data?.[section];
    },
    async listCaseIds() {
      const entries = await readdir(dir, { withFileTypes: true });
      return entries.filter((e) => e.isDirectory() && SAFE_ID.test(e.name)).map((e) => e.name);
    },
  };
}
