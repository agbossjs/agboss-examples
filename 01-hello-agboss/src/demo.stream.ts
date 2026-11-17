import { createApp, ExecutionStatus } from "@agboss/core";
import { HelloAgbossApplication } from "./hello-agboss.application.js";
import { StreamingAnswerWorkflowStart } from "./workflows/streaming-answer/streaming-answer.workflow-start.js";

/**
 * Live only (`npm run demo:stream`, needs OPENROUTER_API_KEY): the support reply streams token by
 * token from OpenRouter into `onStream`, as a chat widget would show it. Offline it only says so:
 * `npm test` proves the same against local stubs.
 */
const key = process.env.OPENROUTER_API_KEY;
if (key === undefined || key === "" || key === "offline-test-openrouter-api-key") {
  process.stdout.write("demo:stream skipped: set OPENROUTER_API_KEY to stream a live answer.\n");
} else {
  const app = await createApp(HelloAgbossApplication);
  const startedAt = performance.now();
  const arrivals: { readonly ms: number; readonly delta: string }[] = [];
  try {
    const run = await app.execute(
      StreamingAnswerWorkflowStart,
      { text: "My invoice INV-5001 shows a charge for a GPU rack that arrived two weeks late. What can you do?" },
      {
        ownerId: "user-demo-1",
        tenant: { tenantId: "tenant-acme", plan: "pro" },
        execution: { userId: "user-demo-1" },
        onStream: (event) => {
          if (event.kind === "textDelta") {
            arrivals.push({ ms: Math.round(performance.now() - startedAt), delta: event.delta });
          }
        },
      },
    );
    if (run.status !== ExecutionStatus.Finished) throw new Error(`run ended ${run.status}`);
    process.stdout.write(
      `${JSON.stringify(
        {
          deltas: arrivals.length,
          firstDeltaMs: arrivals[0]?.ms,
          lastDeltaMs: arrivals.at(-1)?.ms,
          streamedText: arrivals.map((arrival) => arrival.delta).join(""),
          output: run.output,
          spendUsd: run.spend.totalUsd,
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    await app.close();
  }
}
