import { StubLevel } from "../src/stub/stub-gateway.types.js";
import { crashBeforeAnswer, lateRetryAfterServerError, retryAfterDrop } from "./runs.js";
import type { PaymentScenario, ScenarioRow } from "./scenario.types.js";

/**
 * PS6 — the support levels: the right wiring, unchanged, on the three stub gateways. `Full` charges
 * once everywhere it can; `NoLookup` leaves a lost answer `unknown` (a person decides); `NoKeys`
 * charges twice on a retry: not supported. The late replay (PS17 c on each level) is today's
 * boundary #657 — an error of unknown outcome is resent without a lookup.
 */
const levels = [StubLevel.Full, StubLevel.NoLookup, StubLevel.NoKeys] as const;

const retryRows: ScenarioRow[] = levels.map((level) => ({
  row: `ps6 ${level} ps1`,
  level,
  right: level === StubLevel.NoKeys ? { charges: 2, lost: 2500 } : { charges: 1, lost: 0, orderStatus: "paid" },
  run: (context) => retryAfterDrop(context, "ps6", `ps6 ${level} ps1`),
}));

const crashRows: ScenarioRow[] = levels.map((level) => ({
  row: `ps6 ${level} ps5`,
  level,
  right:
    level === StubLevel.Full
      ? { charges: 1, lost: 0, orderStatus: "paid" }
      : { charges: 1, notes: ["pending intents: 1"] }, // unknown: the intent waits for a person
  run: (context) => crashBeforeAnswer(context, "ps6", `ps6 ${level} ps5`, level === StubLevel.Full),
}));

const lateRows: ScenarioRow[] = levels.map((level) => ({
  row: `ps6 ${level} late`,
  level,
  right: { charges: 2, lost: 2500, boundary: "#657" },
  run: (context) => lateRetryAfterServerError(context, "ps6", `ps6 ${level} late`),
}));

export const ps6: PaymentScenario = {
  id: "ps6",
  title: "Support levels: full, no lookup, no keys",
  rows: [...retryRows, ...crashRows, ...lateRows],
};
