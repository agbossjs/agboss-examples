import { Agent, RagMode } from "@agboss/core";
import { HandbookRag } from "../rag/handbook.rag.js";

/** The same knowledge base in context mode: the reranked best 3 come with the question. */
@Agent({
  name: "briefing-agent",
  description: "Briefs from the handbook given first",
  prompt: "Answer from the handbook results given with the question, in one sentence, citing [source].",
  model: "openai/gpt-4.1-nano",
  rag: [{ use: HandbookRag, mode: RagMode.Context }],
})
export class BriefingAgent {}
