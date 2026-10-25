import { testAction } from "agboss/testing";
import { describe, expect, it } from "vitest";
import { ApplyVipCouponAction } from "../../src/actions/apply-vip-coupon.action.js";
import { BuildReceiptAction } from "../../src/actions/build-receipt.action.js";
import { CalculateInitialShippingAction } from "../../src/actions/calculate-initial-shipping.action.js";
import { ComputeLoyaltyAdjustmentAction } from "../../src/actions/compute-loyalty-adjustment.action.js";
import { ComputeTaxAction } from "../../src/actions/compute-tax.action.js";
import { ComputeTaxBranchBAction } from "../../src/actions/compute-tax-branch-b.action.js";
import { InitialQuoteAction } from "../../src/actions/initial-quote.action.js";
import { MutateDestinationAction } from "../../src/actions/mutate-destination.action.js";
import { RecomputeShippingAction } from "../../src/actions/recompute-shipping.action.js";
import { ReconcileInvoiceAction } from "../../src/actions/reconcile-invoice.action.js";
import { ReleaseSeatCompensationAction } from "../../src/actions/release-seat-compensation.action.js";
import { RenderInvoiceAction } from "../../src/actions/render-invoice.action.js";
import { RenderStandardInvoiceAction } from "../../src/actions/render-standard-invoice.action.js";
import { ReserveSeatAction } from "../../src/actions/reserve-seat.action.js";
import { MissingInputFixedStart } from "../../src/workflows/missing-input-fixed/missing-input-fixed.workflow-start.js";
import { OutdatedDataFixedStart } from "../../src/workflows/outdated-data-fixed/outdated-data-fixed.workflow-start.js";
import { UncompensatedFixedStart } from "../../src/workflows/uncompensated-fixed/uncompensated-fixed.workflow-start.js";

const produced = <TProducer, TValue>(
  producer: TProducer,
  value: TValue,
): { readonly producer: TProducer; readonly value: TValue } => ({ producer, value });

describe("Invoice, Shipping, Reconciliation & Saga Actions (@Action)", () => {
  it("computes 20% VIP discount and renders VIP & standard invoices", async () => {
    const runVipCoupon = testAction(ApplyVipCouponAction);
    const { output: coupon } = await runVipCoupon({
      request: produced(MissingInputFixedStart, {
        orderId: "ORD-10",
        tier: "vip",
        subtotalCents: 10_000,
      }),
    });
    expect(coupon).toEqual({ code: "VIP20", discountCents: 2_000 });

    const runVipInvoice = testAction(RenderInvoiceAction);
    const { output: vipInv } = await runVipInvoice({
      request: produced(MissingInputFixedStart, {
        orderId: "ORD-10",
        tier: "vip",
        subtotalCents: 10_000,
      }),
      coupon: produced(ApplyVipCouponAction, coupon),
    });
    expect(vipInv).toEqual({
      orderId: "ORD-10",
      finalTotalCents: 8_000,
      invoiceText: "Order ORD-10 (VIP20): $80.00",
    });

    const runStdInvoice = testAction(RenderStandardInvoiceAction);
    const { output: stdInv } = await runStdInvoice({
      request: produced(MissingInputFixedStart, {
        orderId: "ORD-11",
        tier: "standard",
        subtotalCents: 10_000,
      }),
    });
    expect(stdInv).toEqual({
      orderId: "ORD-11",
      finalTotalCents: 10_000,
      invoiceText: "Order ORD-11 (NO-COUPON): $100.00",
    });
  });

  it("computes shipping, builds fresh receipt, reconciles parallel branches, and reserves/releases seats", async () => {
    const runShipping = testAction(CalculateInitialShippingAction);
    const { output: deShipping } = await runShipping({
      draft: produced(OutdatedDataFixedStart, {
        orderId: "ORD-20",
        subtotalCents: 10_000,
        destinationCountry: "DE",
        requestedCountryChange: "",
      }),
    });
    expect(deShipping).toEqual({ shippingCents: 4_500, quotedForCountry: "DE" });

    const runReceipt = testAction(BuildReceiptAction);
    const { output: receipt } = await runReceipt({
      draft: produced(MutateDestinationAction, {
        orderId: "ORD-20",
        subtotalCents: 10_000,
        destinationCountry: "DE",
        requestedCountryChange: "",
      }),
      shipping: produced(RecomputeShippingAction, deShipping),
      tax: produced(ComputeTaxAction, { taxCents: 1_900 }),
    });
    expect(receipt).toEqual({
      grandTotalCents: 16_400,
      summary: "Order ORD-20 [dest=DE, shipFor=DE]: $164.00",
    });

    const runReconcile = testAction(ReconcileInvoiceAction);
    const { output: reconciled } = await runReconcile({
      quote: produced(InitialQuoteAction, { totalCents: 10_000, source: "initial-quote" }),
      loyalty: produced(ComputeLoyaltyAdjustmentAction, {
        discountCents: 2_000,
        tierApplied: "GOLD-20%",
      }),
      tax: produced(ComputeTaxBranchBAction, { taxCents: 1_000, basedOnCents: 10_000 }),
    });
    expect(reconciled).toEqual({
      grandTotalCents: 8_800,
      pricingSource: "initial-quote+reconciled-after-join",
    });

    const runReserve = testAction(ReserveSeatAction);
    const { output: reservation } = await runReserve({
      booking: produced(UncompensatedFixedStart, {
        bookingId: "BK-500",
        amountCents: 40_000,
      }),
    });
    expect(reservation).toEqual({ reservationCode: "RES-BK-500" });

    const runRelease = testAction(ReleaseSeatCompensationAction);
    const releaseRes = await runRelease({
      reservation: produced(ReserveSeatAction, reservation),
    });
    expect(releaseRes.output).toBeUndefined();
  });
});
