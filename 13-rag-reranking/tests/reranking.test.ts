/**
 * Reranking, end to end (agbossjs/agboss#703): the retriever ranks the answer 27th of 30; Cohere
 * Rerank — its official SDK against the local stub of its documented API — puts it first, and the
 * agent reads it first, in tool mode and in context mode. Its search units are in the turn's cost.
 */
import { expect } from "vitest";
import { callTool, replyWith, testWith } from "@agboss/core/testing";
import { BriefingAgent } from "../src/agents/briefing.agent.js";
import { HandbookAgent } from "../src/agents/handbook.agent.js";
import { HandbookApplication } from "../src/handbook.application.js";
import { ANSWER } from "../src/rag/handbook.data.js";
import { HandbookRag } from "../src/rag/handbook.rag.js";
import { COHERE_RERANK_MODEL, USD_PER_SEARCH_UNIT } from "../src/rerankers/cohere.reranker.js";
import { BriefingWorkflowStart } from "../src/workflows/handbook/briefing.workflow-start.js";
import { HandbookWorkflowStart } from "../src/workflows/handbook/handbook.workflow-start.js";
import { cohereStubForFile } from "./support/cohere-stub.js";

const stub = cohereStubForFile();
// the SDK reaches the stub over HTTP on the loopback
const test = testWith(HandbookApplication, { allowNetwork: ["127.0.0.1"] });
const QUESTION = "When does a new engineer join on-call?";

test("tool mode: the 27th candidate, first after Cohere's reranking, is the first result the agent reads", async ({ app, mockLlm }) => {
  mockLlm(HandbookAgent).thenReturn(
    callTool(HandbookRag, { query: QUESTION }),
    replyWith(`After the third month [${ANSWER.source}].`),
  );

  const result = await app.execute(HandbookWorkflowStart, { text: QUESTION });

  const [search] = result.toolCalls;
  const sources = (search?.output as { results: readonly { source: string }[] }).results.map((r) => r.source);
  expect(sources).toHaveLength(3);
  expect(sources[0]).toBe(ANSWER.source);
  // the SDK sent all 30 candidates, asked for the best 3, on the documented model
  expect(stub.calls.at(-1)).toMatchObject({ model: COHERE_RERANK_MODEL, topN: 3 });
  expect(stub.calls.at(-1)?.documents).toHaveLength(30);
  expect(result.spend.byCategory.retrieval).toBeCloseTo(USD_PER_SEARCH_UNIT, 10);
});

test("context mode: the knowledge block given with the question starts with the answer", async ({ app, mockLlm }) => {
  mockLlm(BriefingAgent).thenAnswer((request) => {
    const input = JSON.stringify(request);
    return replyWith(input.indexOf(ANSWER.source) < input.indexOf("on-call-rota") ? "first" : "not first");
  });

  const result = await app.execute(BriefingWorkflowStart, { text: QUESTION });

  expect(result.output).toEqual({ text: "first" });
});
