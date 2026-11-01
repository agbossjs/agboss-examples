import { testRouter } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { CreditAnalystAgent } from "../../../src/agents/credit-analyst/credit-analyst.agent.js";
import type { CreditApplicationDto } from "../../../src/dto/credit-application.dto.js";
import { CreditLimitCodeRouter } from "../../../src/routers/credit-limit-code/credit-limit-code.router.js";
import { CodeRoutedCreditWorkflowStart } from "../../../src/workflows/credit-review/code-routed-credit.workflow-start.js";
import { CreditDeclinedWorkflowFinish } from "../../../src/workflows/credit-review/credit-declined.workflow-finish.js";
import { applicationWith } from "../../support/applications.js";

/**
 * The code router on its own (`testRouter`): its `route(input)` runs in its step's frame, no model
 * is called. Each threshold at its edge: the last value that passes and the first that does not.
 */

const runRouter = testRouter(CreditLimitCodeRouter);
const input = (application: CreditApplicationDto) => ({
  application: { producer: CodeRoutedCreditWorkflowStart, value: application },
});
const routeOf = async (changes: Partial<CreditApplicationDto>) =>
  (await runRouter(input(applicationWith(changes)))).output;

describe("CreditLimitCodeRouter — the bank's thresholds in code", () => {
  it("AC2: the credit score — 600 goes to the analyst, 599 is declined", async () => {
    expect(await routeOf({ creditScore: 600 })).toBe(CreditAnalystAgent);
    expect(await routeOf({ creditScore: 599 })).toBe(CreditDeclinedWorkflowFinish);
  });

  it("AC2: the debt-to-income ratio — 0.45 goes to the analyst, 0.46 is declined", async () => {
    expect(await routeOf({ debtToIncome: 0.45 })).toBe(CreditAnalystAgent);
    expect(await routeOf({ debtToIncome: 0.46 })).toBe(CreditDeclinedWorkflowFinish);
  });

  it("AC2: the amount — 250 000 goes to the analyst, 250 001 is declined", async () => {
    expect(await routeOf({ amountUsd: 250_000 })).toBe(CreditAnalystAgent);
    expect(await routeOf({ amountUsd: 250_001 })).toBe(CreditDeclinedWorkflowFinish);
  });

  it("AC2: the code router costs nothing — no model call, $0", async () => {
    const run = await runRouter(input(applicationWith({})));

    expect(run.output).toBe(CreditAnalystAgent);
    expect(run.spend.calls).toBe(0);
    expect(run.spend.totalUsd).toBe(0);
    expect(run.spend.trace).toEqual([]);
  });
});
