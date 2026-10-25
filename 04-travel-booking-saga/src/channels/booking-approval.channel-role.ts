import { ChannelOf, ChannelRole, PauseAnswerer } from "agboss";
import { HighValueHoldInputDto } from "../dto/high-value-hold-input.dto.js";

@ChannelRole({
  name: "booking-approval-channel",
  description: "Corporate travel manager approval channel for high-value bookings",
  answeredBy: PauseAnswerer.Channel,
  approves: HighValueHoldInputDto,
})
export abstract class BookingApprovalChannelRole extends ChannelOf<BookingApprovalChannelRole> {}
