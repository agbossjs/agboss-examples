import { Workflow, listOf, start, toFinish } from "@agboss/core";
import { SummarizeSplitAction } from "../../actions/summarize-split.action.js";
import { WalletChargeAction } from "../../actions/wallet-charge.action.js";
import { PaymentDto } from "../../dto/payment.dto.js";
import { SplitSummaryDto } from "../../dto/split-summary.dto.js";
import { WalletDrawDto } from "../../dto/wallet-draw.dto.js";
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
  flow: [
    start(SplitOrderWorkflowStart)
      .returns(listOf(WalletDrawDto))
      .toParallelActions(WalletChargeAction, { maxItems: 4 })
      .join()
      .onJoinError(WalletInsufficientError, toFinish(SplitOrderRefusedWorkflowFinish))
      .returns(listOf(PaymentDto))
      .toAction(SummarizeSplitAction)
      .returns(SplitSummaryDto)
      .toFinish(SplitOrderWorkflowFinish),
  ],
})
export class SplitOrderWorkflow {}
