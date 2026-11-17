import type { Secret } from "@agboss/core";

/** The environment contract: the browser's network rule, the contact form, OpenRouter's key. */
export class AppEnvironment {
  /** The SQLite file of the cost ledger and of the intents the form's outbound call records (`:memory:` in tests). */
  sqlitePath!: string;
  /** One PII key for every instance and process: the same token for one value everywhere. */
  piiPseudonymKey!: Secret;
  /** The secret the business keys' fingerprints are keyed with (`idempotencyKeyField`). */
  idempotencyKey!: Secret;
  /**
   * The origins the browser may request, semicolon-separated (`https://docs.example.com;https://example.org`).
   * Everything else is refused, redirects included — also by the MCP server's browser, which reads
   * the same variable.
   */
  browserAllowedOrigins!: string;
  /** The contact form the submit tool fills: fixed here, never chosen by the model. */
  contactFormUrl!: string;
  /** Where `reconcile` asks the site for a ticket by reference: a server-side call to a trusted address. */
  contactLookupUrl!: string;
  /** OpenRouter's key (a live run only; tests script the models). */
  openRouterApiKey?: Secret;
  /** OpenRouter's base URL: the demo's scripted stand-in on 127.0.0.1, unset → OpenRouter's own. */
  openRouterBaseUrl?: string;
}
