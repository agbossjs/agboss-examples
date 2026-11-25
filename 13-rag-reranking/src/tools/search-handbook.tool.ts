import { Tool } from "@agboss/core";
import { RagQueryDto, RagSearchResultsDto } from "@agboss/core/rag";
import { HandbookRag } from "../rag/handbook.rag.js";

/** The agent's way into the handbook: an ordinary tool over the knowledge base (the reranking happens inside `search`). */
@Tool({
  name: "search-handbook-tool",
  description: "Searches the engineering handbook",
  input: RagQueryDto,
  output: RagSearchResultsDto,
  readOnly: true,
  deps: [HandbookRag],
})
export class SearchHandbookTool {
  constructor(private readonly handbook: HandbookRag) {}

  execute({ query }: RagQueryDto) {
    return this.handbook.search(query);
  }
}
