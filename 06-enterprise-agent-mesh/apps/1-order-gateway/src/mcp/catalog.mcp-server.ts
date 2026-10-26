import { McpServer, McpServerClient } from "@agboss/core/mcp";
import { SkuDetailsDto } from "../dto/sku-details.dto.js";
import { SkuLookupInputDto } from "../dto/sku-lookup-input.dto.js";

const catalogTools = {
  "lookup-sku-tool": { input: SkuLookupInputDto, output: SkuDetailsDto },
};

@McpServer({
  name: "catalog-mcp-server",
  transport: "http",
  url: "http://127.0.0.1:8082/mcp",
  target: { application: "catalog-application", expose: "catalog-mcp" },
  tools: catalogTools,
})
export class CatalogMcpServer extends McpServerClient<typeof catalogTools> {}
