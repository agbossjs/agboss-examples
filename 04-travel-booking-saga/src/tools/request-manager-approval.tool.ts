import { Tool, type ToolHandler } from "@agboss/core";
import { BookingApprovalToolApproval } from "../channels/booking-approval.tool-approval.js";
import { HighValueHoldInputDto } from "../dto/high-value-hold-input.dto.js";
import { HighValueHoldOutputDto } from "../dto/high-value-hold-output.dto.js";

@Tool({
  name: "request-manager-approval-tool",
  description:
    "Requests human manager approval before locking a high-value travel hold",
  approval: BookingApprovalToolApproval,
  input: HighValueHoldInputDto,
  output: HighValueHoldOutputDto,
})
export class RequestManagerApprovalTool implements ToolHandler<
  HighValueHoldInputDto,
  HighValueHoldOutputDto
> {
  execute(input: HighValueHoldInputDto): Promise<HighValueHoldOutputDto> {
    return Promise.resolve(
      Object.assign(new HighValueHoldOutputDto(), {
        approvalToken: `APPROVED-${input.bookingId}-${String(input.amountUsd)}`,
        approved: true,
      }),
    );
  }
}
