import { Agent } from "agboss";
import { SkuDetailsDto } from "../../dto/sku-details.dto.js";
import { SkuLookupInputDto } from "../../dto/sku-lookup-input.dto.js";
import { LookupSkuTool } from "../../tools/lookup-sku.tool.js";

@Agent({
  name: "lookup-sku-agent",
  description: "Reads SKU details from CatalogInventoryService via lookup-sku-tool",
  promptUrls: ["./lookup-sku.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { request: SkuLookupInputDto },
  output: SkuDetailsDto,
  tools: [LookupSkuTool],
  maxToolCalls: 2,
})
export class LookupSkuAgent {}
