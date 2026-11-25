import { Workflow, onStart, toAction, Ttl } from "@agboss/core";
import { ComputeLoyaltyAdjustmentAction } from "../../actions/compute-loyalty-adjustment.action.js";
import { ComputeTaxBranchBAction } from "../../actions/compute-tax-branch-b.action.js";
import { InitialQuoteAction } from "../../actions/initial-quote.action.js";
import { ReconcileInvoiceAction } from "../../actions/reconcile-invoice.action.js";
import { CartRequestDto } from "../../dto/cart-request.dto.js";
import { FinalInvoiceDto } from "../../dto/final-invoice.dto.js";
import { LoyaltyAdjustmentDto } from "../../dto/loyalty-adjustment.dto.js";
import { PricingQuoteDto } from "../../dto/pricing-quote.dto.js";
import { TaxCalculationDto } from "../../dto/tax-calculation.dto.js";
import { ParallelInvalidationFixedFinish } from "./parallel-invalidation-fixed.workflow-finish.js";
import { ParallelInvalidationFixedStart } from "./parallel-invalidation-fixed.workflow-start.js";

@Workflow({
  name: "parallel-invalidation-fixed-workflow",
  version: "0.1.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(ParallelInvalidationFixedStart)
      .toAction(InitialQuoteAction)
      .inParallel([toAction(ComputeLoyaltyAdjustmentAction), toAction(ComputeTaxBranchBAction)])
      .join()
      .toAction(ReconcileInvoiceAction)
      .toFinish(ParallelInvalidationFixedFinish),
  ],
})
export class ParallelInvalidationFixedWorkflow {}
