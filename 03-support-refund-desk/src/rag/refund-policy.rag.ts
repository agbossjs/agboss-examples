import { Rag, type RagConnector, type RagRetrieval } from "@agboss/core/rag";
import { RefundPolicyRetriever } from "../retrievers/refund-policy.retriever.js";
import {
  getActivePolicyVersion,
  setActivePolicyVersion,
} from "../services/in-memory-knowledge-index.service.js";

export { getActivePolicyVersion, setActivePolicyVersion };

@Rag({
  name: "refund-policy-rag",
  description: "Active customer support refund policy knowledge base",
  topK: 3,
  deps: [RefundPolicyRetriever],
})
export class RefundPolicyRag implements RagConnector {
  constructor(private readonly retriever: RefundPolicyRetriever) {}

  retrieve(
    query: string,
    options: { readonly topK: number; readonly signal: AbortSignal },
  ): Promise<RagRetrieval> {
    return this.retriever.retrieve(query, options);
  }
}
