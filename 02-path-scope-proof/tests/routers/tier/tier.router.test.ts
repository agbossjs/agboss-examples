import { testUnit } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { ApplyVipCouponAction } from "../../../src/actions/apply-vip-coupon.action.js";
import { ComputeTaxAction } from "../../../src/actions/compute-tax.action.js";
import { MutateDestinationAction } from "../../../src/actions/mutate-destination.action.js";
import { RenderStandardInvoiceAction } from "../../../src/actions/render-standard-invoice.action.js";
import { AddressChangeRouter } from "../../../src/routers/address-change/address-change.router.js";
import { TierRouter } from "../../../src/routers/tier/tier.router.js";


describe("TierRouter & AddressChangeRouter (@Router DecidedBy.Code)", () => {
  const runTierRouter = testUnit(TierRouter);
  const runAddressChangeRouter = testUnit(AddressChangeRouter);

  it("routes VIP checkout requests to ApplyVipCouponAction and standard requests to RenderStandardInvoiceAction", async () => {
    const vipRoute = await runTierRouter({
      request: {
        orderId: "ORD-1",
        tier: "vip",
        subtotalCents: 10_000,
      },
    });
    expect(vipRoute.output).toBe(ApplyVipCouponAction);

    const standardRoute = await runTierRouter({
      request: {
        orderId: "ORD-2",
        tier: "standard",
        subtotalCents: 10_000,
      },
    });
    expect(standardRoute.output).toBe(RenderStandardInvoiceAction);
  });

  it("routes destination changes to MutateDestinationAction and unchanged orders to ComputeTaxAction", async () => {
    const changed = await runAddressChangeRouter({
      draft: {
        orderId: "ORD-201",
        subtotalCents: 10_000,
        destinationCountry: "US",
        requestedCountryChange: "DE",
      },
    });
    expect(changed.output).toBe(MutateDestinationAction);

    const unchanged = await runAddressChangeRouter({
      draft: {
        orderId: "ORD-202",
        subtotalCents: 10_000,
        destinationCountry: "US",
        requestedCountryChange: "",
      },
    });
    expect(unchanged.output).toBe(ComputeTaxAction);
  });
});
