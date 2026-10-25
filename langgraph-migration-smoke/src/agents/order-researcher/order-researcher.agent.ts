import { Agent } from "agboss";
import { ResearchFindingDto } from "../../dto/research-finding.dto.js";
import { ResearchQuestionDto } from "../../dto/research-question.dto.js";
import { SupportRequestDto } from "../../dto/support-request.dto.js";
import { OrderLookupTool } from "../../tools/order-lookup.tool.js";

@Agent({
  name: "order-researcher-agent",
  description: "Answers one question from the order's facts",
  promptUrls: ["./order-researcher.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { question: ResearchQuestionDto, request: SupportRequestDto },
  output: ResearchFindingDto,
  tools: [OrderLookupTool],
  maxToolCalls: 2,
})
export class OrderResearcherAgent {}
