import { ExecutionContext, Tool, type ToolHandler } from "@agboss/core";
import { RefundSignOffChannel } from "../channels/refund-sign-off.channel-role.js";
import { RefundIssuedDto } from "../dto/refund-issued.dto.js";
import { RefundOrderDto } from "../dto/refund-order.dto.js";
import { RefundApiService } from "../services/refund-api.service.js";

@Tool({
  name: "issue-signed-off-refund-tool",
  description: "Issues a large refund — a supervisor signs it off first",
  input: RefundOrderDto,
  output: RefundIssuedDto,
  channel: RefundSignOffChannel,
  deps: [RefundApiService, ExecutionContext],
})
export class IssueSignedOffRefundTool
  implements ToolHandler<RefundOrderDto, RefundIssuedDto>
{
  constructor(
    private readonly refundApiService: RefundApiService,
    private readonly executionContext: ExecutionContext,
  ) {}

  async run({ orderId, amountCents }: RefundOrderDto): Promise<RefundIssuedDto> {
    const key: string = this.executionContext.step.idempotencyKey;
    return { refundId: await this.refundApiService.issue(orderId, amountCents, key) };
  }
}
