import { McpEndpoint } from "@agboss/core/mcp";
import { LookupSkuTool } from "../tools/lookup-sku.tool.js";
import { CatalogWorkflowStart } from "../workflows/catalog/catalog.workflow-start.js";

/**
 * What the catalog offers MCP clients: the SKU lookup tool of its workflow and the workflow's start. Listed in
 * `@Application({ endpoints })`, served by `mcpHttpListener` (HTTP) or `connectMcp` (any transport).
 */
@McpEndpoint({
  name: "catalog-mcp",
  version: "1.0.0",
  description: "Looks up SKU pricing and stock in the enterprise catalog",
  tools: [LookupSkuTool, CatalogWorkflowStart], // the workflow's tool, and its start
})
export class CatalogMcp {}
