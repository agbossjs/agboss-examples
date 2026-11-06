/**
 * The refund policy knowledge base keeps each tenant's policy to itself (agbossjs/agboss#700, #796):
 * `RefundPolicyRag` declares `RagTenancy.PerTenant`, and the published RAG connector contract
 * proves it — isolation, near-identical tenant ids, re-index replaces, topK, the abort signal, the
 * cost, well-formed results — on the connector as the container makes it.
 */
import { ragConnectorContract } from "@agboss/core/testing/contracts";
import { RefundPolicyRag } from "../../src/rag/refund-policy.rag.js";
import { RefundPolicyRetriever } from "../../src/retrievers/refund-policy.retriever.js";
import { InMemoryKnowledgeIndexService } from "../../src/services/in-memory-knowledge-index.service.js";

/** Each connector's own index, so the suite fills a tenant's knowledge base through it. */
const indexes = new WeakMap<RefundPolicyRag, InMemoryKnowledgeIndexService>();

ragConnectorContract({
  name: "refund-policy-rag (in-memory BM25)",
  connector: () => {
    const index = new InMemoryKnowledgeIndexService();
    const connector = new RefundPolicyRag(new RefundPolicyRetriever(index));
    indexes.set(connector, index);
    return connector;
  },
  documents: (connector, tenantId, documents) => {
    indexes.get(connector)?.replaceDocuments(tenantId, documents);
    return Promise.resolve();
  },
});
