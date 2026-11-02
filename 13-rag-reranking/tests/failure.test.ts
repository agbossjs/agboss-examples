/**
 * When the rerank API fails (agbossjs/agboss#703 AC3): Cohere answers 503 — the default policy gives
 * the agent the retriever's own first 3 and the turn goes on; nothing is billed for the failed call.
 */
import { expect } from "vitest";
import { callTool, replyWith, testWith } from "@agboss/core/testing";
import { HandbookAgent } from "../src/agents/handbook.agent.js";
import { HandbookApplication } from "../src/handbook.application.js";
import { HANDBOOK } from "../src/rag/handbook.data.js";
import { HandbookRag } from "../src/rag/handbook.rag.js";
import { HandbookWorkflowStart } from "../src/workflows/handbook/handbook.workflow-start.js";
import { cohereStubForFile } from "./support/cohere-stub.js";

const stub = cohereStubForFile();
// the SDK reaches the stub over HTTP on the loopback
const test = testWith(HandbookApplication, { allowNetwork: ["127.0.0.1"] });

test("Cohere answers 503: the retriever's own first 3 reach the agent, the turn finishes", async ({ app, mockLlm }) => {
  stub.failNext(503, 2);
  mockLlm(HandbookAgent).thenReturn(callTool(HandbookRag, { query: "on-call?" }), replyWith("done"));

  const result = await app.execute(HandbookWorkflowStart, { text: "on-call?" });

  const [search] = result.toolCalls;
  const sources = (search?.output as { results: readonly { source: string }[] }).results.map((r) => r.source);
  expect(sources).toEqual(HANDBOOK.slice(0, 3).map((p) => p.source));
  expect(result.output).toEqual({ text: "done" });
  expect(result.spend.byCategory.retrieval).toBe(0);
});
