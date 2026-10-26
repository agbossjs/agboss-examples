import { Workflow, start } from "@agboss/core";
import { ResolveBillingInquiryAction } from "../../actions/resolve-billing-inquiry.action.js";
import { BillingInquiryDto } from "../../dto/billing-inquiry.dto.js";
import { BillingResolutionDto } from "../../dto/billing-resolution.dto.js";
import { BillingA2aCallerResolver } from "../../services/billing-a2a-caller-resolver.service.js";
import { BillingApiKeyDirectory } from "../../services/billing-api-key-directory.service.js";
import { BillingWorkflowFinish } from "./billing.workflow-finish.js";
import { BillingWorkflowStart } from "./billing.workflow-start.js";

@Workflow({
  name: "billing-workflow",
  version: "1.0.0",
  flow: [
    start(BillingWorkflowStart)
      .returns(BillingInquiryDto)
      .toAction(ResolveBillingInquiryAction)
      .returns(BillingResolutionDto)
      .toFinish(BillingWorkflowFinish),
  ],
  providers: [BillingApiKeyDirectory, BillingA2aCallerResolver],
})
export class BillingWorkflow {}
