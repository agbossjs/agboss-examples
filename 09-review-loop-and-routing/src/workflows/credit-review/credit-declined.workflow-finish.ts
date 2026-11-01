import { WorkflowFinish } from "@agboss/core";
import { CreditApplicationDto } from "../../dto/credit-application.dto.js";

/** Where an application ends when the router declines it at once: the application, as it came. */
@WorkflowFinish({
  name: "credit-declined-workflow-finish",
  description: "The application is declined before any review",
  output: CreditApplicationDto,
})
export class CreditDeclinedWorkflowFinish {}
