import { ChannelOf, ChannelRole, PauseAnswerer } from "@agboss/core";
import { RefundOrderDto } from "../dto/refund-order.dto.js";

@ChannelRole({
  name: "refund-sign-off-channel",
  description: "A supervisor signs off a large refund before it is issued",
  approves: RefundOrderDto,
  answerer: PauseAnswerer.ThreadOwner,
})
export abstract class RefundSignOffChannel extends ChannelOf<RefundSignOffChannel> {}
