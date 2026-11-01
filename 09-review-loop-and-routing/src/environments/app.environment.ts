import type { Secret } from "@agboss/core";

/** The environment contract: OpenRouter's key and base URL, read by the model providers. */
export class AppEnvironment {
  /** The SQLite file of the cost ledger (`:memory:`: each process counts on its own). */
  sqlitePath!: string;
  /** OpenRouter's key (`apiKey: "openRouterApiKey"`); tests script models and leave it out. */
  openRouterApiKey?: Secret;
  /** OpenRouter's base URL (`baseUrlField`); unset → the provider's default. */
  openRouterBaseUrl?: string;
}
