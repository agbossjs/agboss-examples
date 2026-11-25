import { testUnit } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { DeferPurchaseAction } from "../../src/actions/defer-purchase.action.js";
import { BUDGET_OK, LAPTOPS, PRICE_FAIR } from "../support/reviews.js";

describe("DeferPurchaseAction — group 2's path, code", () => {
  it("defers the purchase with what the commercial reviews found", async () => {
    const run = await testUnit(DeferPurchaseAction)({
      request: LAPTOPS,
      price: PRICE_FAIR,
      budget: BUDGET_OK,
    });

    expect(run.output).toEqual({
      supplier: "Northwind Hardware",
      reason: "the legal and compliance reviews did not both count: the order waits for them",
      benchmarkUsd: 1_250,
      budgetLine: "OPEX-IT-2026",
    });
  });
});
