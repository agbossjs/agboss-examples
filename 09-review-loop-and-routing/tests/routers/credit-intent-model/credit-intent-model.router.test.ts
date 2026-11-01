import { routeTo, testRouter } from "@agboss/core/testing";
import { usd } from "@agboss/core/units";
import { describe, expect, it } from "vitest";
import { CreditAnalystAgent } from "../../../src/agents/credit-analyst/credit-analyst.agent.js";
import { CreditIntentModelRouter } from "../../../src/routers/credit-intent-model/credit-intent-model.router.js";
import { CreditDeclinedWorkflowFinish } from "../../../src/workflows/credit-review/credit-declined.workflow-finish.js";
import { ModelRoutedCreditWorkflowStart } from "../../../src/workflows/credit-review/model-routed-credit.workflow-start.js";
import { SOUND_APPLICATION, WEAK_APPLICATION } from "../../support/applications.js";

/**
 * The model router on its own: its decision model answers by script (`routeTo`), and the call is
 * paid — its spend is `router:credit-intent-model-router`, the scripted cost.
 */

const input = (application: typeof SOUND_APPLICATION) => ({
  application: { producer: ModelRoutedCreditWorkflowStart, value: application },
});

describe("CreditIntentModelRouter — the same decision by a decision model", () => {
  it("AC2: a route to the analyst is one paid decision under router:credit-intent-model-router", async () => {
    const runRouter = testRouter(CreditIntentModelRouter, {
      model: routeTo(CreditAnalystAgent, { cost: usd(0.00004) }),
    });

    const run = await runRouter(input(SOUND_APPLICATION));

    expect(run.output).toBe(CreditAnalystAgent);
    expect(run.spend.calls).toBe(1);
    expect(run.spend.byCaller).toEqual({ "router:credit-intent-model-router": 0.00004 });
    expect(run.spend.byCategory.routing).toBe(0.00004);
  });

  it("AC2: it may stop at the declined finish, the other route the flow lists", async () => {
    const runRouter = testRouter(CreditIntentModelRouter, {
      model: routeTo(CreditDeclinedWorkflowFinish, { cost: usd(0.00004) }),
    });

    const run = await runRouter(input(WEAK_APPLICATION));

    expect(run.output).toBe(CreditDeclinedWorkflowFinish);
  });
});
