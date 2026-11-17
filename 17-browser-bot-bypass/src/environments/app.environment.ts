import type { Secret } from "@agboss/core";

/** The environment contract: the browser's network rule, OpenRouter's key. */
export class AppEnvironment {
  /** The SQLite file of the cost ledger the tenant and application budgets count in (`:memory:` offline). */
  sqlitePath!: string;
  /** One PII key for every instance and process: the same token for one value everywhere. */
  piiPseudonymKey!: Secret;
  /**
   * The origins the browser may request, semicolon-separated (`https://docs.example.com;https://example.org`).
   * Everything else is refused, redirects included — by the tool's browser and by the MCP server's,
   * which reads the same variable. The browser has its own network, outside agboss's A2A SSRF guard.
   */
  browserAllowedOrigins!: string;
  /** OpenRouter's key (a live run only; tests script the models). */
  openRouterApiKey?: Secret;
  /** OpenRouter's base URL: the demo's scripted stand-in on 127.0.0.1, unset → OpenRouter's own. */
  openRouterBaseUrl?: string;
}
