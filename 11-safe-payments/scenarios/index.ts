import { ps1 } from "./ps1-retry-after-timeout.scenario.js";
import { ps2 } from "./ps2-crash-before-checkpoint.scenario.js";
import { ps3 } from "./ps3-zombie-after-takeover.scenario.js";
import { ps4 } from "./ps4-zombie-writes-first.scenario.js";
import { ps5 } from "./ps5-crash-before-answer.scenario.js";
import { ps6 } from "./ps6-support-levels.scenario.js";
import { ps7 } from "./ps7-model-calls-twice.scenario.js";
import { ps8 } from "./ps8-two-executions.scenario.js";
import { ps9 } from "./ps9-parallel-branches.scenario.js";
import { ps10 } from "./ps10-saga-refund.scenario.js";
import { ps11 } from "./ps11-pause-answered-twice.scenario.js";
import { ps12 } from "./ps12-deploy-mid-payment.scenario.js";
import { ps13 } from "./ps13-clock-skew.scenario.js";
import { ps14 } from "./ps14-database-lost-mid-commit.scenario.js";
import { ps15 } from "./ps15-webhook-twice.scenario.js";
import { ps16 } from "./ps16-webhooks-out-of-order.scenario.js";
import { ps17 } from "./ps17-key-expires.scenario.js";
import { ps18 } from "./ps18-partial-capture.scenario.js";
import { ps19 } from "./ps19-refund-retried.scenario.js";
import { ps20 } from "./ps20-void-and-capture.scenario.js";
import { ps21 } from "./ps21-browser-retries.scenario.js";
import { ps22 } from "./ps22-another-card.scenario.js";
import { ps23 } from "./ps23-in-flight-duplicate.scenario.js";
import type { PaymentScenario } from "./scenario.types.js";

/** Every scenario of Wiki → Payment scenarios, PS1–PS23, in order. */
export const SCENARIOS: readonly PaymentScenario[] = [
  ps1, ps2, ps3, ps4, ps5, ps6, ps7, ps8, ps9, ps10, ps11, ps12,
  ps13, ps14, ps15, ps16, ps17, ps18, ps19, ps20, ps21, ps22, ps23,
];

/** The scenarios one test file runs: `from`–`to` (ids `ps<n>`), so the files run in parallel. */
export const scenariosBetween = (from: number, to: number): readonly PaymentScenario[] =>
  SCENARIOS.filter((scenario) => {
    const n = Number(scenario.id.slice(2));
    return n >= from && n <= to;
  });
