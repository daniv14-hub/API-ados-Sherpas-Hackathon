// Developer check: connects to the Sherpas MCP with the .env token and lists the cases.
import { connectMcp } from "../src/case-source.mjs";

const { callTool, close } = await connectMcp(process.env.MCP_URL, process.env.MCP_TOKEN);
try {
  const calls = [
    ["list_cases", {}],
    ["get_case", { caseId: "daniel-emily-johnson", part: "financial-health", section: "score" }],
    ["get_case", { caseId: "daniel-emily-johnson", part: "financial-health" }],
    ["get_case", { caseId: "daniel-emily-johnson", part: "persona", section: "D4" }],
    ["get_case", { caseId: "daniel-emily-johnson", part: "persona" }],
  ];
  for (const [name, args] of calls) {
    const r = await callTool(name, args);
    console.log(`--- ${name} ${JSON.stringify(args)}`);
    console.log("keys:", Object.keys(r), "isError:", r.isError);
    console.log(r.content[0].text.slice(0, 300));
  }
} finally {
  await close();
}
