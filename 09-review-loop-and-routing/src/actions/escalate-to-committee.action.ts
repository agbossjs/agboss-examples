import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { CommitteeEscalationDto } from "../dto/committee-escalation.dto.js";
import { CreditApplicationDto } from "../dto/credit-application.dto.js";
import { CreditMemoDto } from "../dto/credit-memo.dto.js";
import { MemoChangesRequestedDto } from "../dto/memo-changes-requested.dto.js";

/**
 * Hands an application the review loop could not settle to the credit committee — code, no
 * model. Reached from `.onError(VisitsLimitExceededError, …)` when the editor's visits are spent:
 * it reads what the path holds at that moment — the newest memo and the open request.
 */
@Action({
  name: "escalate-to-committee-action",
  description: "Hands the application to the credit committee with the last memo",
  input: {
    application: CreditApplicationDto,
    memo: CreditMemoDto,
    changes: MemoChangesRequestedDto,
  },
  output: CommitteeEscalationDto,
})
export class EscalateToCommitteeAction implements ActionHandler<EscalateToCommitteeAction> {
  execute(input: InputOf<EscalateToCommitteeAction>): Promise<OutputOf<EscalateToCommitteeAction>> {
    const memo = input.memo.value;
    return Promise.resolve({
      applicantName: input.application.value.applicantName,
      lastMemo: memo.text,
      openRequest: input.changes.value.notes,
      recommendedLimitUsd: memo.recommendedLimitUsd,
    });
  }
}
