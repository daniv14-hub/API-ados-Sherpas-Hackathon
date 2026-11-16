import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

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
  if (typeof text !== "string") throw new CaseSourceError("MCP response has no text content");
  return text;
}

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
