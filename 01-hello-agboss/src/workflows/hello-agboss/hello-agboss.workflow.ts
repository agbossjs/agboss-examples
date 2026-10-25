import { Workflow, route, start } from "agboss";
import { QuoteAdvisorAgent } from "../../agents/quote-advisor/quote-advisor.agent.js";
import { SupportSpecialistAgent } from "../../agents/support-specialist/support-specialist.agent.js";
import { CustomerInquiryDto } from "../../dto/customer-inquiry.dto.js";
import { SupportReplyDto } from "../../dto/support-reply.dto.js";
import { IntakeTriageRouter } from "../../routers/intake-triage/intake-triage.router.js";
import { PricingCatalogService } from "../../services/pricing-catalog.service.js";
import { CalculateQuoteTool } from "../../tools/calculate-quote.tool.js";
import { HelloWorkflowFinish } from "./hello.workflow-finish.js";
import { HelloWorkflowStart } from "./hello.workflow-start.js";

@Workflow({
  name: "hello-agboss-workflow",
  version: "0.1.0",
  flow: [
    start(HelloWorkflowStart)
      .returns(CustomerInquiryDto)
      .toRouter(IntakeTriageRouter)
      .chooseOne(
        route(SupportSpecialistAgent)
          .returns(SupportReplyDto)
          .toFinish(HelloWorkflowFinish),
        route(QuoteAdvisorAgent)
          .returns(SupportReplyDto)
          .toFinish(HelloWorkflowFinish),
      ),
  ],
  providers: [PricingCatalogService, CalculateQuoteTool],
})
export class HelloAgbossWorkflow {}
