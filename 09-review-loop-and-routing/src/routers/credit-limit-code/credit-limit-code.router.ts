import { DecidedBy, Router, type InputOf, type Route, type RouterHandler } from "@agboss/core";
import { CreditAnalystAgent } from "../../agents/credit-analyst/credit-analyst.agent.js";
import { CreditApplicationDto } from "../../dto/credit-application.dto.js";
import { CreditDeclinedWorkflowFinish } from "../../workflows/credit-review/credit-declined.workflow-finish.js";

/** Below this score the bank declines at once. */
export const MIN_CREDIT_SCORE = 600;
/** Above this debt-to-income ratio the bank declines at once. */
export const MAX_DEBT_TO_INCOME = 0.45;
/** Above this amount the bank declines at once: it is not a retail credit. */
export const MAX_AMOUNT_USD = 250_000;

/**
 * The bank's thresholds, decided by code (`DecidedBy.Code`): `route(input)` returns the target and
 * no model is called — 0 tokens, $0, no network. The same two routes as
 * `CreditIntentModelRouter`; a target outside `routes` does not compile, and a flow that lists
 * other routes than these is `[router.routes-mismatch]` at `agboss check`.
 */
@Router({
  name: "credit-limit-code-router",
  description: "Declines an application below the bank's thresholds, sends the rest to the analyst",
  decidedBy: DecidedBy.Code,
  input: {
    application: CreditApplicationDto,
  },
  routes: [{ target: CreditAnalystAgent }, { target: CreditDeclinedWorkflowFinish }],
})
export class CreditLimitCodeRouter implements RouterHandler<CreditLimitCodeRouter> {
  route(input: InputOf<CreditLimitCodeRouter>): Promise<Route<CreditLimitCodeRouter>> {
    const { creditScore, debtToIncome, amountUsd } = input.application.value;
    const isDeclined =
      creditScore < MIN_CREDIT_SCORE ||
      debtToIncome > MAX_DEBT_TO_INCOME ||
      amountUsd > MAX_AMOUNT_USD;
    return Promise.resolve(isDeclined ? CreditDeclinedWorkflowFinish : CreditAnalystAgent);
  }
}
