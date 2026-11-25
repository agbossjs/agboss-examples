import { Agent } from "@agboss/core";
import { TriageRequestDto } from "../../dto/triage-request.dto.js";
import { TriageResponseDto } from "../../dto/triage-response.dto.js";
import { SearchCatalogTool } from "../../tools/search-catalog.tool.js";
import { AskBillingTool } from "../../tools/ask-billing.tool.js";

@Agent({
  name: "triage-agent",
  description: "Coordinates catalog MCP lookups and billing A2A inquiries",
  prompt: "./triage.prompt.md",
  model: "openai/gpt-4o-mini",
  input: { request: TriageRequestDto },
  output: TriageResponseDto,
  tools: [SearchCatalogTool, AskBillingTool],
  executionLimits: { maxToolCalls: 4 },
})
export class TriageAgent {}
