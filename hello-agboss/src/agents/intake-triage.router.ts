import { DecidedBy, Router } from "agboss";
import { CustomerInquiryDto } from "../workflows/dtos.js";
import { QuoteAdvisorAgent } from "./quote-advisor.agent.js";
import { SupportSpecialistAgent } from "./support-specialist.agent.js";

@Router({
  name: "intake-triage-router",
  description: "Routes incoming customer inquiries between product support and pricing quotes",
  decidedBy: DecidedBy.Model,
  promptUrls: ["./intake-triage.router.prompt.md"],
  model: "moonshotai/kimi-k2.6",
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
