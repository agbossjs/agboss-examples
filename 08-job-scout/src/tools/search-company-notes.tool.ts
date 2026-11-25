import { Tool } from "@agboss/core";
import { RagQueryDto, RagSearchResultsDto } from "@agboss/core/rag";
import { CompanyNotes } from "../rag/company-notes.rag.js";

/** The scout's way into the user's company notes: an ordinary tool over the knowledge base. */
@Tool({
  name: "search-company-notes-rag-tool",
  description: "Searches the user's notes about companies: stack, culture, what people say",
  input: RagQueryDto,
  output: RagSearchResultsDto,
  readOnly: true,
  deps: [CompanyNotes],
})
export class SearchCompanyNotes {
  constructor(private readonly notes: CompanyNotes) {}

  execute({ query }: RagQueryDto) {
    return this.notes.search(query);
  }
}
