import { decideWith, testArbiter } from "@agboss/core/testing";
import { usd } from "@agboss/core/units";
import { describe, expect, it } from "vitest";
import { BudgetCheckAgent } from "../../src/agents/budget-check/budget-check.agent.js";
import { PriceBenchmarkAgent } from "../../src/agents/price-benchmark/price-benchmark.agent.js";
import { PolicyJudgementArbiter } from "../../src/arbiters/policy-judgement/policy-judgement.arbiter.js";
import { BUDGET_OK, PRICE_FAIR } from "../support/reviews.js";

/** The model half of the `anyOf`: one paid decision per answer, by the agent's criterion. */

describe("PolicyJudgementArbiter — a decision model judges a review the thresholds rejected", () => {
  it("P(counts) above one half: the review counts; the decision is paid under arbiter:<name>", async () => {
    const runArbiter = testArbiter(PolicyJudgementArbiter, {
      model: decideWith({ counts: 0.9 }, { cost: usd(0.00002) }),
    });

    const run = await runArbiter(PriceBenchmarkAgent, { ...PRICE_FAIR, isFairPrice: false });

    expect(run.output).toBe(true);
    expect(run.spend.byCaller).toEqual({ "arbiter:policy-judgement-arbiter": 0.00002 });
  });

  it("P(counts) below one half: the review does not count", async () => {
    const runArbiter = testArbiter(PolicyJudgementArbiter, { model: decideWith({ counts: 0.1 }) });

    const run = await runArbiter(BudgetCheckAgent, { ...BUDGET_OK, remainingUsd: -200 });

    expect(run.output).toBe(false);
  });
});
