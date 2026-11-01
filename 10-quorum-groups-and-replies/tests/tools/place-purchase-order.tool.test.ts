import { testTool } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { PlacePurchaseOrderTool } from "../../src/tools/place-purchase-order.tool.js";
import { LAPTOP_ORDER } from "../support/reviews.js";

describe("PlacePurchaseOrderTool — on its own (its approval is the flow's)", () => {
  it("orders the amount it is called with, under a reference from its call's key", async () => {
    const run = await testTool(PlacePurchaseOrderTool)({ ...LAPTOP_ORDER, amountUsd: 500 });

    expect(run.output.amountUsd).toBe(500);
    expect(run.output.reference).toMatch(/^PO-[0-9A-F]{8}$/);
  });
});
