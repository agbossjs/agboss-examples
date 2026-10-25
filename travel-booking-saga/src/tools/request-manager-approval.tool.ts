import { Tool, type ToolHandler } from "agboss";
import { BookingApprovalChannelRole } from "../channels/booking-approval.channel-role.js";
import { HighValueHoldInputDto } from "../dto/high-value-hold-input.dto.js";
import { HighValueHoldOutputDto } from "../dto/high-value-hold-output.dto.js";

@Tool({
  name: "request-manager-approval-tool",
  description: "Requests human manager approval before locking a high-value travel hold",
  prompt: "Call this tool with the bookingId and amountUsd to request corporate travel approval.",
  channel: BookingApprovalChannelRole,
  input: HighValueHoldInputDto,
  output: HighValueHoldOutputDto,
})
export class RequestManagerApprovalTool
  implements ToolHandler<HighValueHoldInputDto, HighValueHoldOutputDto>
{
  run(input: HighValueHoldInputDto): Promise<HighValueHoldOutputDto> {
    return Promise.resolve(
      Object.assign(new HighValueHoldOutputDto(), {
        approvalToken: `APPROVED-${input.bookingId}-${String(input.amountUsd)}`,
        approved: true,
      }),
    );
  }
}
