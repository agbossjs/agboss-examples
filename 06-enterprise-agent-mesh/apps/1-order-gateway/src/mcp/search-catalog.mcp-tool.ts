import { ExecutionContext, type ToolHandler } from "@agboss/core";
import { McpTool } from "@agboss/core/mcp";
import { kilobytes, seconds } from "@agboss/core/units";
import { SkuDetailsDto } from "../dto/sku-details.dto.js";
import { SkuLookupInputDto } from "../dto/sku-lookup-input.dto.js";
import { CatalogMcpServer } from "./catalog.mcp-server.js";

@McpTool({
  server: CatalogMcpServer,
  name: "search-catalog-tool",
  description: "Looks up SKU details on the remote Catalog MCP server",
  input: SkuLookupInputDto,
  output: SkuDetailsDto,
  timeout: seconds(15),
  maxResultSize: kilobytes(32),
  deps: [CatalogMcpServer, ExecutionContext],
})
export class SearchCatalogTool implements ToolHandler<SkuLookupInputDto, SkuDetailsDto> {
  constructor(
    private readonly catalogMcpServer: CatalogMcpServer,
    private readonly executionContext: ExecutionContext,
  ) {}

  run({ sku }: SkuLookupInputDto): Promise<SkuDetailsDto> {
    return this.catalogMcpServer.call(
      "lookup-sku-tool",
      { sku },
      this.executionContext.signal,
    );
  }
}
