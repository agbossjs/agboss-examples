import { Agent } from "@agboss/core";
import { CustomerInquiryDto } from "../../dto/customer-inquiry.dto.js";
import { SupportReplyDto } from "../../dto/support-reply.dto.js";
import { CalculateQuoteTool } from "../../tools/calculate-quote.tool.js";

@Agent({
  name: "quote-advisor-agent",
  description: "Computes subscription quotes using the injected pricing catalog tool",
  promptUrls: ["./quote-advisor.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { inquiry: CustomerInquiryDto },
  output: SupportReplyDto,
  tools: [CalculateQuoteTool],
  maxTokens: 2000,
})
export class QuoteAdvisorAgent {}
