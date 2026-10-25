import { Agent } from "agboss";
import { TriageRequestDto } from "../../dto/triage-request.dto.js";
import { TriageResponseDto } from "../../dto/triage-response.dto.js";
import { SearchCatalogTool } from "../../mcp/search-catalog.mcp-tool.js";
import { AskBillingTool } from "../../tools/ask-billing.tool.js";

@Agent({
  name: "triage-agent",
  description: "Coordinates catalog MCP lookups and billing A2A inquiries",
  promptUrls: ["./triage.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { request: TriageRequestDto },
  output: TriageResponseDto,
  tools: [SearchCatalogTool, AskBillingTool],
  maxToolCalls: 4,
})
export class TriageAgent {}
