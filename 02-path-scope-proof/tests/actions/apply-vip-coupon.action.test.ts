import { testUnit } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { ApplyVipCouponAction } from "../../src/actions/apply-vip-coupon.action.js";
import { BuildReceiptAction } from "../../src/actions/build-receipt.action.js";
import { CalculateInitialShippingAction } from "../../src/actions/calculate-initial-shipping.action.js";
import { ReconcileInvoiceAction } from "../../src/actions/reconcile-invoice.action.js";
import { ReleaseSeatCompensationAction } from "../../src/actions/release-seat-compensation.action.js";
import { RenderInvoiceAction } from "../../src/actions/render-invoice.action.js";
import { RenderStandardInvoiceAction } from "../../src/actions/render-standard-invoice.action.js";
import { ReserveSeatAction } from "../../src/actions/reserve-seat.action.js";


describe("Invoice, Shipping, Reconciliation & Saga Actions (@Action)", () => {
  it("computes 20% VIP discount and renders VIP & standard invoices", async () => {
    const runVipCoupon = testUnit(ApplyVipCouponAction);
    const { output: coupon } = await runVipCoupon({
      request: {
        orderId: "ORD-10",
        tier: "vip",
        subtotalCents: 10_000,
      },
    });
    expect(coupon).toEqual({ code: "VIP20", discountCents: 2_000 });

    const runVipInvoice = testUnit(RenderInvoiceAction);
    const { output: vipInv } = await runVipInvoice({
      request: {
        orderId: "ORD-10",
        tier: "vip",
        subtotalCents: 10_000,
      },
      coupon: coupon,
    });
    expect(vipInv).toEqual({
      orderId: "ORD-10",
      finalTotalCents: 8_000,
      invoiceText: "Order ORD-10 (VIP20): $80.00",
    });

    const runStdInvoice = testUnit(RenderStandardInvoiceAction);
    const { output: stdInv } = await runStdInvoice({
      request: {
        orderId: "ORD-11",
        tier: "standard",
        subtotalCents: 10_000,
      },
    });
    expect(stdInv).toEqual({
      orderId: "ORD-11",
      finalTotalCents: 10_000,
      invoiceText: "Order ORD-11 (NO-COUPON): $100.00",
    });
  });

  it("computes shipping, builds fresh receipt, reconciles parallel branches, and reserves/releases seats", async () => {
    const runShipping = testUnit(CalculateInitialShippingAction);
    const { output: deShipping } = await runShipping({
      draft: {
        orderId: "ORD-20",
        subtotalCents: 10_000,
        destinationCountry: "DE",
        requestedCountryChange: "",
      },
    });
    expect(deShipping).toEqual({ shippingCents: 4_500, quotedForCountry: "DE" });

    const runReceipt = testUnit(BuildReceiptAction);
    const { output: receipt } = await runReceipt({
      draft: {
        orderId: "ORD-20",
        subtotalCents: 10_000,
        destinationCountry: "DE",
        requestedCountryChange: "",
      },
      shipping: deShipping,
      tax: { taxCents: 1_900 },
    });
    expect(receipt).toEqual({
      grandTotalCents: 16_400,
      summary: "Order ORD-20 [dest=DE, shipFor=DE]: $164.00",
    });

    const runReconcile = testUnit(ReconcileInvoiceAction);
    const { output: reconciled } = await runReconcile({
      quote: { totalCents: 10_000, source: "initial-quote" },
      loyalty: { discountCents: 2_000 },
      tax: { taxCents: 1_000 },
    });
    expect(reconciled).toEqual({
      grandTotalCents: 8_800,
      pricingSource: "initial-quote+reconciled-after-join",
    });

    const runReserve = testUnit(ReserveSeatAction);
    const { output: reservation } = await runReserve({
      booking: {
        bookingId: "BK-500",
        amountCents: 40_000,
      },
    });
    expect(reservation).toEqual({ reservationCode: "RES-BK-500" });

    const runRelease = testUnit(ReleaseSeatCompensationAction);
    const releaseRes = await runRelease({
      reservation: reservation,
    });
    expect(releaseRes.output).toBeUndefined();
  });
});
