import { ChannelOf, ChannelRole, PauseAnswerer } from "@agboss/core";
import { hours } from "@agboss/core/units";
import { HighValueHoldInputDto } from "../dto/high-value-hold-input.dto.js";

@ChannelRole({
  name: "booking-approval-channel",
  description: "Corporate travel manager approval channel for high-value bookings",
  answerer: PauseAnswerer.Channel,
  approves: HighValueHoldInputDto,
  // the manager has half a working day; an operator can move this deadline (`app.extendPause`)
  expiresIn: hours(4),
})
export abstract class BookingApprovalChannelRole extends ChannelOf<BookingApprovalChannelRole> {}
