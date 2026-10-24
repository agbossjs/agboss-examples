import {
  Action,
  DecidedBy,
  ExecutionContext,
  Router,
  WorkflowFinish,
  WorkflowStart,
  type ActionHandler,
  type InputOf,
  type OutputOf,
  type Route,
  type RouterHandler,
} from "agboss";
import { RefundSignOffAgent, ResearchPlannerAgent } from "./support.agents.js";
import { RefundIssuedDto, ReplyDraftDto, SupportRequestDto } from "./support.dto.js";
import { RefundApiService } from "./support.services.js";

@WorkflowStart({
  name: "support-workflow-start",
  description: "A customer's message about an order",
  input: SupportRequestDto,
})
export class SupportWorkflowStart {}

@WorkflowFinish({
  name: "refund-issued-workflow-finish",
  description: "The refund was issued",
  output: RefundIssuedDto,
})
export class RefundIssuedWorkflowFinish {}

@WorkflowFinish({
  name: "hand-over-workflow-finish",
  description: "Not a refund: for the team",
  output: SupportRequestDto,
})
export class HandOverWorkflowFinish {}

@WorkflowFinish({
  name: "reply-stuck-workflow-finish",
  description: "The review did not converge",
  output: SupportRequestDto,
})
export class ReplyStuckWorkflowFinish {}

@Router({
  name: "support-triage-router",
  description: "Sends a refund request on, hands anything else over",
  decidedBy: DecidedBy.Model,
  prompt: "Decide whether the customer asks for a refund.",
  model: "moonshotai/kimi-k2.6",
  input: { request: SupportRequestDto },
  routes: [
    { prompt: "The customer asks for a refund", target: ResearchPlannerAgent },
    {
      prompt: "Stop and hand the message over: it is not about a refund",
      target: HandOverWorkflowFinish,
    },
  ],
})
export class SupportTriageRouter {}

@Action({
  name: "issue-refund-action",
  description: "Issues a refund below the sign-off limit",
  input: { request: SupportRequestDto, draft: ReplyDraftDto },
  output: RefundIssuedDto,
  deps: [RefundApiService, ExecutionContext],
})
export class IssueRefundAction implements ActionHandler<IssueRefundAction> {
  constructor(
    private readonly refundApiService: RefundApiService,
    private readonly executionContext: ExecutionContext,
  ) {}

  async execute(input: InputOf<IssueRefundAction>): Promise<OutputOf<IssueRefundAction>> {
    const key: string = this.executionContext.step.idempotencyKey;
    return {
      refundId: await this.refundApiService.issue(
        input.request.value.orderId,
        input.draft.value.refundCents,
        key,
      ),
    };
  }
}

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
