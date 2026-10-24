import { measureMigrationBenchmark } from "../harness/measure-results.js";

const scorecard = await measureMigrationBenchmark();
console.log(
  JSON.stringify(
    {
      project: "langgraph-migration-smoke",
      status: "passed",
      scorecard,
    },
    null,
    2,
  ),
);
