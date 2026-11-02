import { Rag } from "@agboss/core/rag";
import { CohereReranker } from "../rerankers/cohere.reranker.js";
import { HandbookSearch } from "./handbook-search.js";

/**
 * The handbook as the agent searches it: 30 candidates from the retriever, Cohere Rerank keeps the
 * best 3. Swapping Cohere for AGBoss's LLM reranker is this one line: `by: HandbookLlmReranker`.
 */
@Rag({
  name: "handbook-rag",
  description: "The engineering handbook: onboarding, on-call, tooling",
  rerank: { by: CohereReranker, candidates: 30, keep: 3 },
})
export class HandbookRag extends HandbookSearch {}
