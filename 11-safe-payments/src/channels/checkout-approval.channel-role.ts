import { ChannelOf, ChannelRole, PauseAnswerer } from "@agboss/core";
import { ChargeToolInputDto } from "../dto/charge-tool-input.dto.js";

/**
 * A large order waits for the customer's own approval (PS11): the thread's owner answers
 * (`PauseAnswerer.ThreadOwner`), by the pause id the paused execution lists.
 */
@ChannelRole({
  name: "checkout-approval-channel",
  description: "The customer approves the charge of a large order",
  approves: ChargeToolInputDto,
  answeredBy: PauseAnswerer.ThreadOwner,
})
export abstract class CheckoutApprovalChannel extends ChannelOf<CheckoutApprovalChannel> {}
