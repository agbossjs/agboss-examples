/**
 * A reranker sees only the tenant's own candidates (agbossjs/agboss#700, #703 AC5): the RAG
 * source contract, run through Cohere Rerank on its SDK against the stub — isolation, near-identical
 * tenant ids, re-index, topK, the signal, the cost — on an in-memory connector of the handbook's shape.
 */
import { ragSourceContract, type RagContractDocument } from "@agboss/core/testing/contracts";
import { RagScope, RagSource, type RagIndexOptions, type RagRetrieval, type RagRetrieveOptions } from "@agboss/core/rag";
import { usd } from "@agboss/core/units";
import { CohereClientV2 } from "cohere-ai";
import { afterAll, expect } from "vitest";
import { CohereRerankStub } from "../src/stub/cohere-rerank.stub.js";
import { CohereReranker } from "../src/rerankers/cohere.reranker.js";

/** The stub in process: the suite's cases run outside `testWith`, where the network is closed. */
const stub = new CohereRerankStub();
// every case reranked through Cohere — a silent fallback would prove nothing
afterAll(() => {
  expect(stub.calls.length).toBeGreaterThan(5);
});

/** A tenant-scoped knowledge base in memory: each tenant's documents, indexed on `index`. */
class TenantDocuments extends RagSource {
  readonly sources = new Map<string, readonly RagContractDocument[]>();
  private readonly indexed = new Map<string, readonly RagContractDocument[]>();

  override index({ scopeId, signal }: RagIndexOptions) {
    signal.throwIfAborted();
    const key = scopeId ?? "";
    const documents = this.sources.get(key) ?? [];
    this.indexed.set(key, documents);
    return Promise.resolve({ documents: documents.length, chunks: documents.length, skipped: 0, costUsd: usd(0) });
  }

  protected override retrieve(query: string, { topK, scopeId, signal }: RagRetrieveOptions): Promise<RagRetrieval> {
    signal.throwIfAborted();
    const words = query.toLowerCase().split(/\W+/u).filter((w) => w.length > 2);
    const hits = (this.indexed.get(scopeId ?? "") ?? []).filter((d) => words.some((w) => d.text.toLowerCase().includes(w)));
    return Promise.resolve({ results: hits.slice(0, topK), costUsd: usd(0) });
  }
}

// the reranker as the container makes it, its client answering from the stub
const client = new CohereClientV2({ token: "offline-stub", fetch: stub.fetch, maxRetries: 0 });
const reranker = new CohereReranker({ client });

ragSourceContract({
  name: "in-memory handbook + Cohere Rerank",
  scope: RagScope.Tenant,
  source: () => new TenantDocuments(),
  documents: (source, scopeId, documents) => {
    source.sources.set(scopeId, documents);
    return Promise.resolve();
  },
  rerank: { by: reranker, candidates: 20 },
});
