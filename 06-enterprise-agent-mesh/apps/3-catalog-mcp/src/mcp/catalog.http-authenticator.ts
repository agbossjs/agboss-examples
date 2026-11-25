import { HttpAuthenticator, HttpAuthResult, HttpSecurity, type HttpAuthRequest } from "@agboss/core";
import { CatalogApiKeyDirectory } from "../services/catalog-api-key-directory.service.js";

/**
 * Who calls the catalog's MCP endpoint when it is no signed mesh peer (an external client): a known bearer key
 * is its tenant and owner, anything else is `401`. There is no anonymous door: `mcpHttpListener` is never given
 * `allowAnonymous`. A mesh peer is admitted by its signature (`X-AGBoss-Mesh`), before this runs.
 */
@HttpAuthenticator({ deps: [CatalogApiKeyDirectory], schemes: [HttpSecurity.bearer()] })
export class CatalogHttpAuthenticator {
  constructor(private readonly catalogApiKeyDirectory: CatalogApiKeyDirectory) {}

  async authenticate(request: HttpAuthRequest): Promise<HttpAuthResult> {
    const header: string = request.http.headers.authorization ?? "";
    if (!header.startsWith("Bearer ")) {
      return HttpAuthResult.unauthenticated("Missing Bearer API key", { challenge: 'Bearer realm="catalog-mcp"' });
    }
    const grant = await this.catalogApiKeyDirectory.grantOf(header.slice("Bearer ".length).trim());
    if (grant === undefined) {
      return HttpAuthResult.unauthenticated("Unknown API key", { challenge: 'Bearer realm="catalog-mcp"' });
    }
    return HttpAuthResult.authenticated({ tenant: { tenantId: grant.tenantId }, ownerId: grant.clientId });
  }
}
