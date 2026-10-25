import { Injectable } from "agboss";
import type { RagRetrieval } from "agboss/rag";
import {
  InMemoryKnowledgeIndexService,
  type ScoredPolicyChunk,
} from "../services/in-memory-knowledge-index.service.js";

/**
 * Domain retriever injected into `RefundPolicyRag`.
 * Delegates BM25/TF-IDF token search to `InMemoryKnowledgeIndexService` and exposes
 * both AGBoss `RagRetrieval` results and structured `ScoredPolicyChunk` metadata.
 */
@Injectable({ deps: [InMemoryKnowledgeIndexService] })
export class RefundPolicyRetriever {
  constructor(private readonly index: InMemoryKnowledgeIndexService) {}

  retrieveChunks(query: string, topK = 3): readonly ScoredPolicyChunk[] {
    return this.index.search(query, { topK });
  }

  retrieve(
    query: string,
    options: { readonly topK: number; readonly signal?: AbortSignal },
  ): Promise<RagRetrieval> {
    options.signal?.throwIfAborted();
    const ranked = this.index.search(query, { topK: options.topK });
    return Promise.resolve({
      results: ranked.map((chunk) => ({
        text: chunk.text,
        source: chunk.source,
        score: chunk.score,
      })),
    });
  }
}
