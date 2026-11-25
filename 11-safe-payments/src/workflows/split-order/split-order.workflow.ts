import { Workflow, onStart, toAction, Ttl } from "@agboss/core";
import { RefuseSplitAction } from "../../actions/refuse-split.action.js";
import { SummarizeSplitAction } from "../../actions/summarize-split.action.js";
import { WalletChargeAction } from "../../actions/wallet-charge.action.js";
import { WalletInsufficientError } from "../../payments/payment-operations.js";
import { SplitOrderRefusedWorkflowFinish } from "./split-order-refused.workflow-finish.js";
import { SplitOrderWorkflowFinish } from "./split-order.workflow-finish.js";
import { SplitOrderWorkflowStart } from "./split-order.workflow-start.js";

/**
 * PS9: the parts of a split order run as parallel branches, each drawing on the customer's one
 * wallet and charging its part. The wallet's invariant — never below zero — is the application's:
 * checked by the wallet row's own constraint in the draw's fenced effect.
 */
@Workflow({
  name: "split-order-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(SplitOrderWorkflowStart)
      .forEachItem(toAction(WalletChargeAction), { takeFirst: 4 })
      .join()
      .onError(WalletInsufficientError, toAction(RefuseSplitAction)
.toFinish(SplitOrderRefusedWorkflowFinish))
      .toAction(SummarizeSplitAction)
      .toFinish(SplitOrderWorkflowFinish),
  ],
})
export class SplitOrderWorkflow {}
