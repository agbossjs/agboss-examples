import { ChannelOf, ChannelRole, PauseAnswerer } from "@agboss/core";
import { ChargeToolInputDto } from "../dto/charge-tool-input.dto.js";

/**
 * The 3DS outcome of a payment (PS21): answered by whichever comes first — the customer's browser
 * on the return page, or the gateway's webhook — through the channel's own side (the pause id is
 * the channel's). The second answer is `NotPausedError`.
 */
@ChannelRole({
  name: "three-ds-outcome-channel",
  description: "The customer completes 3DS: the return page or the webhook says so",
  approves: ChargeToolInputDto,
  answeredBy: PauseAnswerer.Channel,
})
export abstract class ThreeDsOutcomeChannel extends ChannelOf<ThreeDsOutcomeChannel> {}
