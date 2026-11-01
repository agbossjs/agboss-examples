import { WorkflowStart } from "@agboss/core";
import { CreditApplicationDto } from "../../dto/credit-application.dto.js";

/** Where an application is routed by code: the bank's thresholds, no model, $0. */
@WorkflowStart({
  name: "code-routed-credit-workflow-start",
  description: "A credit application, routed by the bank's thresholds in code",
  input: CreditApplicationDto,
})
export class CodeRoutedCreditWorkflowStart {}
