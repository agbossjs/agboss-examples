import {
  Rag,
  RagTenancy,
  type RagConnector,
  type RagRetrieval,
  type RagRetrieveOptions,
} from "@agboss/core/rag";
import { RefundPolicyRetriever } from "../retrievers/refund-policy.retriever.js";
import {
  getActivePolicyVersion,
  setActivePolicyVersion,
} from "../services/in-memory-knowledge-index.service.js";

export { getActivePolicyVersion, setActivePolicyVersion };

/**
 * Each tenant's own refund policy (agbossjs/agboss#700, #796): every retrieval reads the
 * execution's `tenantId` — another tenant's policy is never returned. Proved by
 * `ragConnectorContract` (`tests/rag/refund-policy.rag-contract.test.ts`).
 */
@Rag({
  name: "refund-policy-rag",
  description: "Active customer support refund policy knowledge base",
  tenancy: RagTenancy.PerTenant,
  topK: 3,
  deps: [RefundPolicyRetriever],
})
export class RefundPolicyRag implements RagConnector {
  constructor(private readonly retriever: RefundPolicyRetriever) {}

  retrieve(query: string, options: RagRetrieveOptions): Promise<RagRetrieval> {
    return this.retriever.retrieve(query, options);
  }
}
