import { Workflow, start } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";
import { ApprovalAgent } from "../../agents/approval/approval.agent.js";
import { ApprovedCheckoutWorkflowFinish } from "./approved-checkout.workflow-finish.js";
import { ApprovedCheckoutWorkflowStart } from "./approved-checkout.workflow-start.js";

/** PS11: a large order, charged once the customer approves. */
@Workflow({
  name: "approved-checkout-workflow",
  version: "1.0.0",
  flow: [
    start(ApprovedCheckoutWorkflowStart)
      .returns(WorkflowStartTextDto)
      .toAgent(ApprovalAgent)
      .toFinish(ApprovedCheckoutWorkflowFinish),
  ],
  defaults: { models: { temperature: 0 } },
})
export class ApprovedCheckoutWorkflow {}
