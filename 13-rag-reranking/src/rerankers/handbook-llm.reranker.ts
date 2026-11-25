import { RagReranker, RerankFailurePolicy } from "@agboss/core/rag";

/**
 * AGBoss's own LLM reranker on a cheap model of the application's provider (OpenRouter here) —
 * the alternative to Cohere: `reranker: HandbookLlmReranker` in `handbook.rag.ts`. It has no code of
 * its own: an empty `@RagReranker` class with a `model` is the core's LLM reranker.
 */
@RagReranker({
  name: "handbook-llm-reranker",
  description: "Reranks the handbook on a cheap chat model",
  candidates: 30,
  onFailure: RerankFailurePolicy.Fallback,
  model: "openai/gpt-4.1-nano",
})
export class HandbookLlmReranker {}
