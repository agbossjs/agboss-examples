import { Workflow, onStart, toAgent, Ttl } from "@agboss/core";
import { QuoteAdvisorAgent } from "../../agents/quote-advisor/quote-advisor.agent.js";
import { SupportSpecialistAgent } from "../../agents/support-specialist/support-specialist.agent.js";
import { IntakeTriageRouter } from "../../routers/intake-triage/intake-triage.router.js";
import { PricingCatalogService } from "../../services/pricing-catalog.service.js";
import { CalculateQuoteTool } from "../../tools/calculate-quote.tool.js";
import { HelloWorkflowFinish } from "./hello.workflow-finish.js";
import { HelloWorkflowStart } from "./hello.workflow-start.js";

@Workflow({
  name: "hello-agboss-workflow",
  version: "0.1.1",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(HelloWorkflowStart)
      .toRouter(IntakeTriageRouter)
      .onRoute(toAgent(SupportSpecialistAgent)
.toFinish(HelloWorkflowFinish))
      .onRoute(toAgent(QuoteAdvisorAgent)
.toFinish(HelloWorkflowFinish)),
  ],
  providers: [PricingCatalogService, CalculateQuoteTool],
})
export class HelloAgbossWorkflow {}
