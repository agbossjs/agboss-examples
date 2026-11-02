import { Agent, RagMode } from "@agboss/core";
import { HandbookRag } from "../rag/handbook.rag.js";

/** Answers from the handbook: it searches it (tool mode), reads the reranked best 3 and cites one. */
@Agent({
  name: "handbook-agent",
  description: "Answers questions about the engineering handbook",
  prompt: "Answer from the handbook: search it, answer in one sentence and cite the source as [source].",
  model: "openai/gpt-4.1-nano",
  rag: [{ use: HandbookRag, mode: RagMode.Tool }],
})
export class HandbookAgent {}
