import { usd } from "@agboss/core/units";
import { RagSource, type RagRetrieval, type RagRetrieveOptions } from "@agboss/core/rag";
import { HANDBOOK } from "./handbook.data.js";

/** Each tenant's handbook (#700: a retrieval reads its own tenant's only). */
const HANDBOOKS: ReadonlyMap<string, typeof HANDBOOK> = new Map([["default", HANDBOOK]]);

/**
 * The retriever both knowledge bases share: the tenant's passages in their stored order — a stand-in
 * for any keyword or vector index that ranks near-misses first. Free.
 */
export abstract class HandbookSearch extends RagSource {
  protected override retrieve(_query: string, options: RagRetrieveOptions): Promise<RagRetrieval> {
    options.signal.throwIfAborted();
    if (options.tenantId === undefined) throw new Error("the handbook is per tenant: a retrieval names its tenant"); // fail closed
    const passages = HANDBOOKS.get(options.tenantId) ?? [];
    return Promise.resolve({ results: passages.slice(0, options.topK), costUsd: usd(0) });
  }
}
