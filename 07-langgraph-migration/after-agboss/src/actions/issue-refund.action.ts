import {
  Action,
  ExecutionContext,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { RefundIssuedDto } from "../dto/refund-issued.dto.js";
import { ReplyDraftDto } from "../dto/reply-draft.dto.js";
import { SupportRequestDto } from "../dto/support-request.dto.js";
import { RefundApiService } from "../services/refund-api.service.js";

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
