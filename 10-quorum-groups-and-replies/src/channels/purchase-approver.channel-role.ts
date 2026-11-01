import { ChannelOf, ChannelRole, PauseAnswerer } from "@agboss/core";
import { PlacePurchaseOrderDto } from "../dto/place-purchase-order.dto.js";
import { PurchaseReplyInterpreter } from "../reply-interpreters/purchase/purchase.reply-interpreter.js";

/**
 * The role a purchase order is approved through: it approves `place-purchase-order-tool` calls, and
 * the approver answers through the channel's own side (`PauseAnswerer.Channel` — the pause's id is
 * the channel's, never the caller's). The approver writes free text; `PurchaseReplyInterpreter`
 * reads it into the typed decision. Its one implementation is listed in
 * `@Application({ providers })`: `ConsoleApproverChannel`.
 */
@ChannelRole({
  name: "purchase-approver-channel",
  description: "A purchasing approver approves a purchase order, in free text",
  approves: PlacePurchaseOrderDto,
  answeredBy: PauseAnswerer.Channel,
  replyInterpreter: PurchaseReplyInterpreter,
})
export abstract class PurchaseApproverChannel extends ChannelOf<PurchaseApproverChannel> {}
