import { WorkflowStart } from "@agboss/core";
import { CreditApplicationDto } from "../../dto/credit-application.dto.js";

/** Where an application is routed by a decision model: the same thresholds, read with the purpose. */
@WorkflowStart({
  name: "model-routed-credit-workflow-start",
  description: "A credit application, routed by a decision model",
  input: CreditApplicationDto,
})
export class ModelRoutedCreditWorkflowStart {}
