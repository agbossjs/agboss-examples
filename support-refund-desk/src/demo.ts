import { runEvalScenario } from "../scenarios/evals.js";
import { runMemoryDriftScenario } from "../scenarios/memory-drift.js";
import { runPiiScenario } from "../scenarios/pii.js";
import { runPolicyScenario } from "../scenarios/policy.js";

const pii = await runPiiScenario();
const policy = await runPolicyScenario();
const memoryDrift = await runMemoryDriftScenario();
const evals = await runEvalScenario();

console.log(
  JSON.stringify(
    {
      project: "support-refund-desk",
      status: "passed",
      scenarios: {
        pii,
        policy,
        memoryDrift,
        evals,
      },
    },
    null,
    2,
  ),
);
