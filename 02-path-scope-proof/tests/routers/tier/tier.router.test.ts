import { testRouter } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { ApplyVipCouponAction } from "../../../src/actions/apply-vip-coupon.action.js";
import { ComputeTaxAction } from "../../../src/actions/compute-tax.action.js";
import { MutateDestinationAction } from "../../../src/actions/mutate-destination.action.js";
import { RenderStandardInvoiceAction } from "../../../src/actions/render-standard-invoice.action.js";
import { AddressChangeRouter } from "../../../src/routers/address-change/address-change.router.js";
import { TierRouter } from "../../../src/routers/tier/tier.router.js";
import { MissingInputFixedStart } from "../../../src/workflows/missing-input-fixed/missing-input-fixed.workflow-start.js";
import { OutdatedDataFixedStart } from "../../../src/workflows/outdated-data-fixed/outdated-data-fixed.workflow-start.js";

const produced = <TProducer, TValue>(
  producer: TProducer,
  value: TValue,
): { readonly producer: TProducer; readonly value: TValue } => ({ producer, value });

describe("TierRouter & AddressChangeRouter (@Router DecidedBy.Code)", () => {
  const runTierRouter = testRouter(TierRouter);
  const runAddressChangeRouter = testRouter(AddressChangeRouter);

  it("routes VIP checkout requests to ApplyVipCouponAction and standard requests to RenderStandardInvoiceAction", async () => {
    const vipRoute = await runTierRouter({
      request: produced(MissingInputFixedStart, {
        orderId: "ORD-1",
        tier: "vip",
        subtotalCents: 10_000,
      }),
    });
    expect(vipRoute.output).toBe(ApplyVipCouponAction);

    const standardRoute = await runTierRouter({
      request: produced(MissingInputFixedStart, {
        orderId: "ORD-2",
        tier: "standard",
        subtotalCents: 10_000,
      }),
    });
    expect(standardRoute.output).toBe(RenderStandardInvoiceAction);
  });

  it("routes destination changes to MutateDestinationAction and unchanged orders to ComputeTaxAction", async () => {
    const changed = await runAddressChangeRouter({
      draft: produced(OutdatedDataFixedStart, {
        orderId: "ORD-201",
        subtotalCents: 10_000,
        destinationCountry: "US",
        requestedCountryChange: "DE",
      }),
    });
    expect(changed.output).toBe(MutateDestinationAction);

    const unchanged = await runAddressChangeRouter({
      draft: produced(OutdatedDataFixedStart, {
        orderId: "ORD-202",
        subtotalCents: 10_000,
        destinationCountry: "US",
        requestedCountryChange: "",
      }),
    });
    expect(unchanged.output).toBe(ComputeTaxAction);
  });
});
