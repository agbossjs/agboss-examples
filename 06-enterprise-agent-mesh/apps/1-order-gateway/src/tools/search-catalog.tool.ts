import { ExecutionContext, Tool, type ToolHandler } from "@agboss/core";
import { kilobytes, seconds } from "@agboss/core/units";
import { SkuDetailsDto } from "../dto/sku-details.dto.js";
import { SkuLookupInputDto } from "../dto/sku-lookup-input.dto.js";
import { CatalogMcpServer } from "../mcp/catalog.mcp-server.js";

/** The tool the model sees: it calls the catalog's MCP tool (declared on `CatalogMcpServer`), typed by its `tools`. */
@Tool({
  name: "search-catalog-tool",
  description: "Looks up SKU details on the remote Catalog MCP server",
  input: SkuLookupInputDto,
  output: SkuDetailsDto,
  timeout: seconds(15),
  maxResultSize: kilobytes(32),
  readOnly: true,
  deps: [CatalogMcpServer, ExecutionContext],
})
export class SearchCatalogTool implements ToolHandler<SkuLookupInputDto, SkuDetailsDto> {
  constructor(
    private readonly catalogMcpServer: CatalogMcpServer,
    private readonly executionContext: ExecutionContext,
  ) {}

  execute({ sku }: SkuLookupInputDto): Promise<SkuDetailsDto> {
    return this.catalogMcpServer.call("lookup-sku-tool", { sku }, { signal: this.executionContext.signal });
  }
}
