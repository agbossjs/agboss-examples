import { DecidedBy, Router } from "@agboss/core";
import { QuoteAdvisorAgent } from "../../agents/quote-advisor/quote-advisor.agent.js";
import { SupportSpecialistAgent } from "../../agents/support-specialist/support-specialist.agent.js";
import { CustomerInquiryDto } from "../../dto/customer-inquiry.dto.js";

@Router({
  name: "intake-triage-router",
  description: "Routes incoming customer inquiries between product support and pricing quotes",
  decidedBy: DecidedBy.Model,
  promptUrls: ["./intake-triage.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { inquiry: CustomerInquiryDto },
  maxVisits: 2,
  routes: [
    {
      target: SupportSpecialistAgent,
      prompt: "General product, architecture, or technical support question",
    },
    {
      target: QuoteAdvisorAgent,
      prompt: "Pricing, subscription tier, or seat quote request",
    },
  ],
})
export class IntakeTriageRouter {}
