/**
 * The refund policy knowledge base keeps each tenant's policy to itself (agbossjs/agboss#700, #796):
 * `RefundPolicyRag` declares `RagScope.Tenant`, and the published RAG connector contract
 * proves it — isolation, near-identical tenant ids, re-index replaces, topK, the abort signal, the
 * cost, well-formed results — on the connector as the container makes it.
 */
import { ragSourceContract } from "@agboss/core/testing/contracts";
import { RagScope } from "@agboss/core/rag";
import { RefundPolicyRag } from "../../src/rag/refund-policy.rag.js";
import { RefundPolicyRetriever } from "../../src/retrievers/refund-policy.retriever.js";
import { InMemoryKnowledgeIndexService } from "../../src/services/in-memory-knowledge-index.service.js";

/** Each connector's own index, so the suite fills a tenant's knowledge base through it. */
const indexes = new WeakMap<RefundPolicyRag, InMemoryKnowledgeIndexService>();

ragSourceContract({
  name: "refund-policy-rag (in-memory BM25)",
  scope: RagScope.Tenant,
  source: () => {
    const index = new InMemoryKnowledgeIndexService();
    const connector = new RefundPolicyRag(new RefundPolicyRetriever(index));
    indexes.set(connector, index);
    return connector;
  },
  documents: (source, scopeId, documents) => {
    indexes.get(source)?.replaceDocuments(scopeId, documents);
    return Promise.resolve();
  },
});
