import { Rag, RagTenancy } from "@agboss/core/rag";
import { CohereReranker } from "../rerankers/cohere.reranker.js";
import { HandbookSearch } from "./handbook-search.js";

/**
 * The handbook as the agent searches it: 30 candidates from the retriever, Cohere Rerank keeps the
 * best 3. Swapping Cohere for AGBoss's LLM reranker is this one line: `by: HandbookLlmReranker`.
 * Each tenant's own handbook (agbossjs/agboss#796): `HandbookSearch` reads `options.tenantId`.
 */
@Rag({
  name: "handbook-rag",
  description: "The engineering handbook: onboarding, on-call, tooling",
  tenancy: RagTenancy.PerTenant,
  rerank: { by: CohereReranker, candidates: 30, topK: 3 },
})
export class HandbookRag extends HandbookSearch {}
