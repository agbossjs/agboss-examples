/**
 * `npm run demo` — offline, $0: the Cohere SDK against the local stub of its rerank API, OpenRouter's
 * wire scripted. Everything printed is read from the executions (`result.output`, `result.spend`)
 * and the stub's own records; the demo checks what it prints and exits non-zero when a promise
 * does not hold.
 */
import { createApp } from "@agboss/core";
import { HandbookApplication } from "./handbook.application.js";
import { createOfflineOpenRouter } from "./offline/offline-openrouter.js";
import { ANSWER, HANDBOOK } from "./rag/handbook.data.js";
import { CohereRerankStub } from "./stub/cohere-rerank.stub.js";
import { BriefingWorkflowStart } from "./workflows/handbook/briefing.workflow-start.js";

const QUESTION = "When does a new engineer join on-call?";

function check(condition: boolean, what: string): void {
  if (!condition) throw new Error(`demo check failed: ${what}`);
}

const stub = new CohereRerankStub();
const openRouter = createOfflineOpenRouter();
process.env.COHERE_BASE_URL = await stub.start();
const app = await createApp(HandbookApplication, {
  env: "offline",
  processEnv: { ...process.env, OPENROUTER_API_KEY: "offline" },
  providerFetch: openRouter.fetch,
});

try {
  console.log(`Question: ${QUESTION}`);
  console.log(`Retriever's top 3: ${HANDBOOK.slice(0, 3).map((p) => p.source).join(", ")}`);
  console.log(`The answer's place in the retrieval: ${String(HANDBOOK.indexOf(ANSWER) + 1)} of ${String(HANDBOOK.length)}`);

  const reranked = await app.execute(BriefingWorkflowStart, { text: QUESTION });
  const answer = (reranked.output as { text: string }).text;
  console.log(`\nReranked by Cohere (${String(stub.calls.at(-1)?.documents.length)} candidates → top ${String(stub.calls.at(-1)?.topN)}):`);
  console.log(`  agent: ${answer}`);
  for (const line of reranked.spend.trace)
    console.log(`  spend: ${line.caller} ${line.model} $${line.costUsd.toFixed(6)} (${line.category})`);
  check(answer.includes(ANSWER.source), "the reranked answer cites the 27th candidate");
  check(reranked.spend.byCategory.retrieval > 0, "Cohere's search unit is in the retrieval spend");

  stub.failNext(503, 2);
  const fallback = await app.execute(BriefingWorkflowStart, { text: QUESTION });
  const fallbackAnswer = (fallback.output as { text: string }).text;
  console.log("\nCohere answers 503 — fallback: the retriever's own order");
  console.log(`  agent: ${fallbackAnswer}`);
  check(fallbackAnswer.includes(HANDBOOK[0]?.source ?? "?"), "the fallback cites the retriever's first");
  console.log("\nAll checks passed.");
} finally {
  await app.close();
  await stub.stop();
}
