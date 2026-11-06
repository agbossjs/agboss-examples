import { Injectable } from "@agboss/core";
import type { RagRetrieval, RagRetrieveOptions } from "@agboss/core/rag";
import {
  InMemoryKnowledgeIndexService,
  type ScoredPolicyChunk,
} from "../services/in-memory-knowledge-index.service.js";

/**
 * Domain retriever injected into `RefundPolicyRag`.
 * Delegates BM25/TF-IDF token search to `InMemoryKnowledgeIndexService` — the asking tenant's
 * corpus only (agbossjs/agboss#700) — and exposes both AGBoss `RagRetrieval` results and structured
 * `ScoredPolicyChunk` metadata.
 */
@Injectable({ deps: [InMemoryKnowledgeIndexService] })
export class RefundPolicyRetriever {
  constructor(private readonly index: InMemoryKnowledgeIndexService) {}

  retrieveChunks(query: string, tenantId: string, topK = 3): readonly ScoredPolicyChunk[] {
    return this.index.search(query, { topK, tenantId });
  }

  /** The tenant's top-k passages; an aborted signal rejects the promise. */
  retrieve(query: string, options: RagRetrieveOptions): Promise<RagRetrieval> {
    return Promise.resolve().then(() => {
      options.signal.throwIfAborted();
      const ranked = this.index.search(query, { topK: options.topK, tenantId: options.tenantId });
      return {
        results: ranked.map((chunk) => ({
          text: chunk.text,
          source: chunk.source,
          score: chunk.score,
        })),
      };
    });
  }
}
