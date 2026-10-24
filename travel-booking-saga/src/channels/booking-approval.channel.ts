import {
  Channel,
  type ChannelAsk,
  ChannelOf,
  ChannelOutcome,
  ChannelRole,
  type ChannelWithdrawal,
  PauseAnswerer,
  Tool,
  type ToolHandler,
} from "agboss";
import {
  HighValueHoldInputDto,
  HighValueHoldOutputDto,
} from "../workflows/dtos.js";

export interface RecordedPauseAsk {
  readonly pauseId: string;
  readonly summary: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

export interface RecordedPauseWithdrawal {
  readonly pauseId: string;
  readonly resolution: string;
}

const sentAsks: RecordedPauseAsk[] = [];
const withdrawnAsks: RecordedPauseWithdrawal[] = [];
let askWaiters: (() => void)[] = [];

export function resetChannelRecords(): void {
  sentAsks.length = 0;
  withdrawnAsks.length = 0;
  askWaiters = [];
}

export function waitForChannelAskSent(): Promise<void> {
  if (sentAsks.length > 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    askWaiters.push(resolve);
  });
}

export function getSentChannelAsks(): readonly RecordedPauseAsk[] {
  return [...sentAsks];
}

export function getWithdrawnChannelAsks(): readonly RecordedPauseWithdrawal[] {
  return [...withdrawnAsks];
}

@ChannelRole({
  name: "booking-approval-channel",
  description: "Corporate travel manager approval channel for high-value bookings",
  answeredBy: PauseAnswerer.Channel,
  approves: HighValueHoldInputDto,
})
export abstract class BookingApprovalChannelRole extends ChannelOf<BookingApprovalChannelRole> {}

@Channel({
  name: "corporate-booking-approval-channel",
  description: "Posts high-value travel hold approvals and withdraws them on cancellation or sibling failure",
})
export class CorporateBookingApprovalChannel extends BookingApprovalChannelRole {
  override send(
    ask: ChannelAsk<BookingApprovalChannelRole>,
  ): Promise<ChannelOutcome<BookingApprovalChannelRole>> {
    sentAsks.push({
      pauseId: ask.pauseId,
      summary: ask.value.summary,
      arguments: { ...ask.value.arguments },
    });
    for (const waiter of askWaiters.splice(0)) {
      waiter();
    }
    return Promise.resolve(ChannelOutcome.awaitReply());
  }

  override withdraw(withdrawal: ChannelWithdrawal<BookingApprovalChannelRole>): Promise<void> {
    withdrawnAsks.push({
      pauseId: withdrawal.pauseId,
      resolution: withdrawal.resolution,
    });
    return Promise.resolve();
  }
}

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
