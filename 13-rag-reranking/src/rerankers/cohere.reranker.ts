// Independent example, not affiliated with Cohere; "Cohere" names only its public API. Read on
// 2026-11-02: https://docs.cohere.com/reference/rerank, https://docs.cohere.com/docs/rerank-overview,
// pricing https://cohere.com/pricing — check them before relying on this code.
// one entry for a reranker's author (agbossjs/agboss#818): DecidedBy and RagSearchResultDto too
import {
  DecidedBy,
  Reranker,
  type RagSearchResultDto,
  type RerankerHandler,
  type RerankOptions,
  type RerankResult,
} from "@agboss/core/rag";
import { CohereClientService } from "../services/cohere-client.service.js";

/** The rerank model (the SDK's own reference example). */
export const COHERE_RERANK_MODEL = "rerank-v4.0-pro";

/**
 * USD per search unit (one query over up to 100 documents) — a placeholder: put your contract's
 * price here (https://cohere.com/pricing). It is what the budgets count for each reranking.
 */
export const USD_PER_SEARCH_UNIT = 0.002;

/** Cohere Rerank on its official SDK, as a code `@Reranker`: the candidates in, their indexes out. */
@Reranker({
  name: "cohere-reranker",
  description: "Cohere Rerank (cohere-ai)",
  decidedBy: DecidedBy.Code,
  deps: [CohereClientService],
})
export class CohereReranker implements RerankerHandler {
  constructor(private readonly cohereClientService: CohereClientService) {}

  async rerank(
    query: string,
    candidates: readonly RagSearchResultDto[],
    options: RerankOptions,
  ): Promise<RerankResult> {
    const response = await this.cohereClientService.client.rerank(
      {
        model: COHERE_RERANK_MODEL,
        query,
        documents: candidates.map((candidate) => candidate.text),
        topN: options.topK,
      },
      { abortSignal: options.signal },
    );
    // each result names a candidate by its index: the core checks they are the candidates given
    const results = response.results.flatMap(({ index, relevanceScore }) => {
      const candidate = candidates[index];
      return candidate === undefined
        ? []
        : [{ source: candidate.source, text: candidate.text, score: relevanceScore }];
    });
    const searchUnits = response.meta?.billedUnits?.searchUnits ?? 1;
    return { results, costUsd: searchUnits * USD_PER_SEARCH_UNIT };
  }
}
