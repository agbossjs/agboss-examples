import { McpExpose } from "agboss/mcp";
import { LookupSkuTool } from "../tools/lookup-sku.tool.js";
import { CatalogWorkflowStart } from "../workflow-starts/catalog.workflow-start.js";

@McpExpose({
  name: "catalog-mcp",
  version: "1.0.0",
  exports: [LookupSkuTool, CatalogWorkflowStart],
})
export class CatalogMcp {}
