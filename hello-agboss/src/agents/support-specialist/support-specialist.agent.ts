import { Agent } from "agboss";
import { CustomerInquiryDto } from "../../dto/customer-inquiry.dto.js";
import { SupportReplyDto } from "../../dto/support-reply.dto.js";

@Agent({
  name: "support-specialist-agent",
  description: "Answers general product and technical support questions",
  promptUrls: ["./support-specialist.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { inquiry: CustomerInquiryDto },
  output: SupportReplyDto,
  maxTokens: 2000,
})
export class SupportSpecialistAgent {}
