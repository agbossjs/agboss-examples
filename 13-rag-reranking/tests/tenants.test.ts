/**
 * A reranker sees only the tenant's own candidates (agbossjs/agboss#700, #703 AC5): the RAG
 * connector contract, run through Cohere Rerank on its SDK against the stub — isolation, near-identical
 * tenant ids, re-index, topK, the signal, the cost — on an in-memory connector of the handbook's shape.
 */
import { ragConnectorContract, type RagContractDocument } from "@agboss/core/testing/contracts";
import type { RagConnector, RagIndexOptions, RagRetrieval, RagRetrieveOptions } from "@agboss/core/rag";
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
class TenantDocuments implements RagConnector {
  readonly sources = new Map<string, readonly RagContractDocument[]>();
  private readonly indexed = new Map<string, readonly RagContractDocument[]>();

  index({ tenantId, signal }: RagIndexOptions) {
    signal.throwIfAborted();
    const documents = this.sources.get(tenantId) ?? [];
    this.indexed.set(tenantId, documents);
    return Promise.resolve({ documents: documents.length, chunks: documents.length, skipped: 0, costUsd: 0 });
  }

  retrieve(query: string, { topK, tenantId, signal }: RagRetrieveOptions): Promise<RagRetrieval> {
    signal.throwIfAborted();
    const words = query.toLowerCase().split(/\W+/u).filter((w) => w.length > 2);
    const hits = (this.indexed.get(tenantId) ?? []).filter((d) => words.some((w) => d.text.toLowerCase().includes(w)));
    return Promise.resolve({ results: hits.slice(0, topK), costUsd: 0 });
  }
}

// the reranker as the container makes it, its client answering from the stub
const client = new CohereClientV2({ token: "offline-stub", fetch: stub.fetch, maxRetries: 0 });
const reranker = new CohereReranker({ client });

ragConnectorContract({
  name: "in-memory handbook + Cohere Rerank",
  connector: () => new TenantDocuments(),
  documents: (connector, tenantId, documents) => {
    connector.sources.set(tenantId, documents);
    return Promise.resolve();
  },
  rerank: { by: reranker, candidates: 20 },
});
