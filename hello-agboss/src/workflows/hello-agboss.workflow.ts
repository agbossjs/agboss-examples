import { Workflow, WorkflowFinish, WorkflowStart, route, start } from "agboss";
import { IntakeTriageRouter } from "../agents/intake-triage.router.js";
import { QuoteAdvisorAgent } from "../agents/quote-advisor.agent.js";
import { SupportSpecialistAgent } from "../agents/support-specialist.agent.js";
import { CalculateQuoteTool, PricingCatalogService } from "../tools/calculate-quote.tool.js";
import { CustomerInquiryDto, SupportReplyDto } from "./dtos.js";

@WorkflowStart({
  name: "hello-workflow-start",
  description: "Entry point for customer product or pricing inquiries",
  input: CustomerInquiryDto,
})
export class HelloStart {}

@WorkflowFinish({
  name: "hello-workflow-finish",
  description: "Structured reply from either support or pricing specialist",
  output: SupportReplyDto,
})
export class HelloFinish {}

@Workflow({
  name: "hello-agboss-workflow",
  version: "0.1.0",
  flow: [
    start(HelloStart)
      .returns(CustomerInquiryDto)
      .toRouter(IntakeTriageRouter)
      .chooseOne(
        route(SupportSpecialistAgent)
          .returns(SupportReplyDto)
          .toFinish(HelloFinish),
        route(QuoteAdvisorAgent)
          .returns(SupportReplyDto)
          .toFinish(HelloFinish),
      ),
  ],
  providers: [PricingCatalogService, CalculateQuoteTool],
})
export class HelloAgbossWorkflow {}
