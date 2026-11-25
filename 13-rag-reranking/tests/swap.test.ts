/**
 * Swapping the reranker (agbossjs/agboss#703 AC4): AGBoss's LLM reranker in place of Cohere is the
 * `reranker` of the `@Rag` — the same retriever, candidates and topK; nothing else changes. The swapped
 * declaration below is `handbook.rag.ts` with that one line changed, run with `testUnit`.
 */
import { expect } from "vitest";
import { Rag, RagScope } from "@agboss/core/rag";
import { replyWith, testUnit, testWith } from "@agboss/core/testing";
import { HandbookApplication } from "../src/handbook.application.js";
import { ANSWER } from "../src/rag/handbook.data.js";
import { HandbookSearch } from "../src/rag/handbook-search.js";
import { HandbookRag } from "../src/rag/handbook.rag.js";
import { HandbookLlmReranker } from "../src/rerankers/handbook-llm.reranker.js";
import { cohereStubForFile } from "./support/cohere-stub.js";

cohereStubForFile();
// the SDK reaches the stub over HTTP on the loopback
const test = testWith(HandbookApplication, { allowNetwork: ["127.0.0.1"] });

@Rag({
  name: "handbook-rag",
  description: "The engineering handbook: onboarding, on-call, tooling",
  scope: RagScope.Tenant,
  topK: 3,
  reranker: HandbookLlmReranker,
})
class HandbookRagOnTheLlmReranker extends HandbookSearch {}

test("the same handbook, reranked by Cohere or by the LLM reranker: the answer first either way", async () => {
  const cohere = await testUnit(HandbookRag)("When does a new engineer join on-call?");
  // the LLM reranker's model names candidate 27 first (scripted: no model is called)
  const llm = await testUnit(HandbookRagOnTheLlmReranker, { model: replyWith('{"ranking":[27]}') })(
    "When does a new engineer join on-call?",
  );

  expect(cohere.output[0]?.source).toBe(ANSWER.source);
  expect(llm.output[0]?.source).toBe(ANSWER.source);
  expect(llm.output).toHaveLength(cohere.output.length);
});
