import type { Secret } from "@agboss/core";

/** The environment contract: the rerank API's key and address, OpenRouter's key. */
export class AppEnvironment {
  /** The SQLite file of the cost ledger the tenant and application budgets count in. */
  sqlitePath!: string;
  /**
   * The application's PII pseudonym key (`@Application({ pseudonymKey: "piiPseudonymKey" })`): one
   * token per value on every instance and in every process, not a key of each execution.
   */
  piiPseudonymKey!: Secret;
  /** Cohere's API key (a live run only); offline, the stub takes any. */
  cohereApiKey?: Secret;
  /** Where the Cohere SDK sends its calls: the local stub offline, unset → Cohere's own API. */
  cohereBaseUrl?: string;
  /** OpenRouter's key, for the LLM reranker and the agent (a live run only; tests script models). */
  openRouterApiKey?: Secret;
}
