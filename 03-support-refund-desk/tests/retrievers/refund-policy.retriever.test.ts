import { testRag } from "agboss/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { RefundPolicyRag, setActivePolicyVersion } from "../../src/rag/refund-policy.rag.js";
import { RefundPolicyRetriever } from "../../src/retrievers/refund-policy.retriever.js";
import { InMemoryKnowledgeIndexService } from "../../src/services/in-memory-knowledge-index.service.js";

describe("RefundPolicyRetriever & RefundPolicyRag (In-Memory BM25/TF-IDF Knowledge Base)", () => {
  beforeEach(() => {
    setActivePolicyVersion("current");
  });

  it("ranks the exact matching policy chunk first for distinct domain queries via RefundPolicyRetriever", () => {
    const index = new InMemoryKnowledgeIndexService();
    const retriever = new RefundPolicyRetriever(index);

    const digitalLicenseResults = retriever.retrieveChunks(
      "downloaded digital software license activation key redeemed",
      2,
    );
    expect(digitalLicenseResults[0]?.policyId).toBe("policy-digital-licenses");
    expect(digitalLicenseResults[0]?.source).toBe(
      "refund-policy-current.md#policy-digital-licenses",
    );

    const vipRestockingResults = retriever.retrieveChunks(
      "VIP enterprise restocking fee hardware carrier return label",
      2,
    );
    expect(vipRestockingResults[0]?.policyId).toBe("policy-vip-restocking");
    expect(vipRestockingResults[0]?.source).toBe(
      "refund-policy-current.md#policy-vip-restocking",
    );

    const windowResults = retriever.retrieveChunks(
      "30 calendar days delivery eligibility window",
      2,
    );
    expect(windowResults[0]?.policyId).toBe("policy-window");
    expect(windowResults[0]?.source).toBe("refund-policy-current.md#policy-window");

    const capResults = retriever.retrieveChunks(
      "500 USD automatic approval cap supervisor escalation",
      2,
    );
    expect(capResults[0]?.policyId).toBe("policy-cap");
    expect(capResults[0]?.source).toBe("refund-policy-current.md#policy-cap");
  });

  it("wires RefundPolicyRetriever into @Rag (RefundPolicyRag) and validates via testRag()", async () => {
    const searchRag = testRag(RefundPolicyRag);

    const { output: digitalChunks } = await searchRag(
      "digital software license activation key",
      { topK: 2 },
    );
    expect(digitalChunks).toHaveLength(2);
    expect(digitalChunks[0]?.source).toBe(
      "refund-policy-current.md#policy-digital-licenses",
    );
    expect(digitalChunks[0]?.text).toContain("[policy-digital-licenses]");

    const { output: vipChunks } = await searchRag(
      "VIP enterprise restocking fee",
      { topK: 2 },
    );
    expect(vipChunks).toHaveLength(2);
    expect(vipChunks[0]?.source).toBe("refund-policy-current.md#policy-vip-restocking");
    expect(vipChunks[0]?.text).toContain("[policy-vip-restocking]");
  });
});
