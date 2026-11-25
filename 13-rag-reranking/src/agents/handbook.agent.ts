import { Agent, inline } from "@agboss/core";
import { SearchHandbookTool } from "../tools/search-handbook.tool.js";

/** Answers from the handbook: it searches it (a tool over the knowledge base), reads the reranked best 3 and cites one. */
@Agent({
  name: "handbook-agent",
  description: "Answers questions about the engineering handbook",
  prompt: inline("Answer from the handbook: search it, answer in one sentence and cite the source as [source]."),
  model: "openai/gpt-4.1-nano",
  tools: [SearchHandbookTool],
})
export class HandbookAgent {}
