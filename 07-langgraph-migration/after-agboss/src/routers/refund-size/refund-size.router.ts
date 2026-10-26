import {
  DecidedBy,
  Router,
  type InputOf,
  type Route,
  type RouterHandler,
} from "@agboss/core";
import { IssueRefundAction } from "../../actions/issue-refund.action.js";
import { RefundSignOffAgent } from "../../agents/refund-sign-off/refund-sign-off.agent.js";
import { ReplyDraftDto } from "../../dto/reply-draft.dto.js";

const REFUND_SIGN_OFF_CENTS = 10_000;

@Router({
  name: "refund-size-router",
  description: "Issues a small refund at once, sends a large one for sign-off",
  decidedBy: DecidedBy.Code,
  input: { draft: ReplyDraftDto },
  routes: [{ target: IssueRefundAction }, { target: RefundSignOffAgent }],
})
export class RefundSizeRouter implements RouterHandler<RefundSizeRouter> {
  route(input: InputOf<RefundSizeRouter>): Route<RefundSizeRouter> {
    return input.draft.value.refundCents > REFUND_SIGN_OFF_CENTS
      ? RefundSignOffAgent
      : IssueRefundAction;
  }
}
