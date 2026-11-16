import { ChannelOf, ChannelRole, PauseAnswerer } from "@agboss/core";
import { HighValueHoldInputDto } from "../dto/high-value-hold-input.dto.js";

@ChannelRole({
  name: "booking-approval-channel",
  description: "Corporate travel manager approval channel for high-value bookings",
  answerer: PauseAnswerer.Channel,
  approves: HighValueHoldInputDto,
})
export abstract class BookingApprovalChannelRole extends ChannelOf<BookingApprovalChannelRole> {}
