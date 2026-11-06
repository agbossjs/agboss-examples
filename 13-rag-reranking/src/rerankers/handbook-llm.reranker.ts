import { ModelReranker, Reranker } from "@agboss/core/rag";

/**
 * AGBoss's own LLM reranker on a cheap model of the application's providers (OpenRouter here) —
 * the alternative to Cohere: `rerank: { by: HandbookLlmReranker, … }` in `handbook.rag.ts`. It has
 * no code of its own: `extends ModelReranker` makes it a reranker class `rerank.by` accepts.
 */
@Reranker({
  name: "handbook-llm-reranker",
  description: "Reranks the handbook on a cheap chat model",
  model: "openai/gpt-4.1-nano",
})
export class HandbookLlmReranker extends ModelReranker {}
