import { Agent } from "agboss";
import { CustomerInquiryDto, SupportReplyDto } from "../workflows/dtos.js";

@Agent({
  name: "support-specialist-agent",
  description: "Answers general product and technical support questions",
  promptUrls: ["./support-specialist.agent.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { inquiry: CustomerInquiryDto },
  output: SupportReplyDto,
  maxTokens: 2000,
})
export class SupportSpecialistAgent {}
