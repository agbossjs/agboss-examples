import { runBackpressureAndReadinessScenario } from "../scenarios/backpressure-and-readiness.js";
import { runWorkStealingAndRecursionScenario } from "../scenarios/work-stealing-and-recursion.js";

const workStealing = await runWorkStealingAndRecursionScenario();
const health = await runBackpressureAndReadinessScenario();

process.stdout.write(
  `${JSON.stringify(
    {
      project: "cluster-work-stealing",
      workStealing,
      health,
    },
    null,
    2,
  )}\n`,
);
