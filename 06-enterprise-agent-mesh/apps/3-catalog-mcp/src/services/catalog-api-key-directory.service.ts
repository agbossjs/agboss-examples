import { Injectable, defineEnv, secret, type InferEnv } from "@agboss/core";

/** Whom a catalog API key stands for: an external MCP client (Claude Desktop, another agent) that is no mesh peer. */
export interface CatalogApiKeyGrant {
  readonly clientId: string;
  readonly tenantId: string;
}

/** The key the catalog knows, a secret read once when the application starts (never written in the code). */
const catalogKeysEnv = defineEnv({ reader: secret("CATALOG_READER_API_KEY") });

/** The host's own key store (a database, a KMS, …): the example's holds one read-only client. */
@Injectable({ deps: [catalogKeysEnv] })
export class CatalogApiKeyDirectory {
  constructor(private readonly keys: InferEnv<typeof catalogKeysEnv>) {}

  grantOf(apiKey: string): Promise<CatalogApiKeyGrant | undefined> {
    return Promise.resolve(
      apiKey === this.keys.reader.reveal() ? { clientId: "catalog-reader", tenantId: "acme" } : undefined,
    );
  }
}
