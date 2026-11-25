import { Rag, RagScope } from "@agboss/core/rag";
import { CohereReranker } from "../rerankers/cohere.reranker.js";
import { HandbookSearch } from "./handbook-search.js";

/**
 * The handbook as the agent searches it: 30 candidates from the retriever (`candidates` of the reranker),
 * Cohere Rerank keeps the best 3 (`topK`). Swapping Cohere for AGBoss's LLM reranker is this one line:
 * `reranker: HandbookLlmReranker`. Each tenant's own handbook (agbossjs/agboss#796): `RagScope.Tenant`,
 * `HandbookSearch` reads `options.tenantId`.
 */
@Rag({
  name: "handbook-rag",
  description: "The engineering handbook: onboarding, on-call, tooling",
  scope: RagScope.Tenant,
  topK: 3,
  reranker: CohereReranker,
})
export class HandbookRag extends HandbookSearch {}
