import { DecidedBy, Router } from "@agboss/core";
import { CreditAnalystAgent } from "../../agents/credit-analyst/credit-analyst.agent.js";
import { CreditApplicationDto } from "../../dto/credit-application.dto.js";
import { DECISION_MODEL } from "../../model-providers/models.js";
import { CreditDeclinedWorkflowFinish } from "../../workflows/credit-review/credit-declined.workflow-finish.js";

/**
 * The same decision, made by a decision model (`DecidedBy.Model`, Jev): it reads the application —
 * the numbers and the applicant's own words — and picks one of the same two routes. It costs a
 * model call, which `result.spend` shows under `router:credit-intent-model-router`. Its route to the
 * finish is worded as a stop instruction.
 */
@Router({
  name: "credit-intent-model-router",
  description: "Declines an application below the bank's thresholds, sends the rest to the analyst",
  decidedBy: DecidedBy.Model,
  model: DECISION_MODEL,
  prompt:
    "Decide where a retail credit application goes. The bank declines at once when the credit " +
    "score is below 600, when the debt-to-income ratio is above 0.45, or when the amount is above " +
    "250000 US dollars; every other application goes to a credit analyst.",
  input: {
    application: CreditApplicationDto,
  },
  maxVisits: 1,
  routes: [
    {
      target: CreditAnalystAgent,
      prompt: "The application meets every threshold: an analyst writes the credit memo",
    },
    {
      target: CreditDeclinedWorkflowFinish,
      prompt: "Stop and decline the application: it fails a threshold",
    },
  ],
})
export class CreditIntentModelRouter {}
