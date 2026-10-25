import { Agent } from "agboss";
import { CalculateQuoteTool } from "../tools/calculate-quote.tool.js";
import { CustomerInquiryDto, SupportReplyDto } from "../workflows/dtos.js";

@Agent({
  name: "quote-advisor-agent",
  description: "Computes subscription quotes using the injected pricing catalog tool",
  promptUrls: ["./quote-advisor.agent.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { inquiry: CustomerInquiryDto },
  output: SupportReplyDto,
  tools: [CalculateQuoteTool],
  maxTokens: 2000,
})
export class QuoteAdvisorAgent {}
