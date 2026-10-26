import { ExecutionContext, Tool, type ToolHandler } from "@agboss/core";
import { SkuDetailsDto } from "../dto/sku-details.dto.js";
import { SkuLookupInputDto } from "../dto/sku-lookup-input.dto.js";
import { CatalogInventoryService } from "../services/catalog-inventory.service.js";

@Tool({
  name: "lookup-sku-tool",
  description: "Looks up SKU pricing and stock levels in the enterprise catalog",
  input: SkuLookupInputDto,
  output: SkuDetailsDto,
  deps: [CatalogInventoryService, ExecutionContext],
})
export class LookupSkuTool implements ToolHandler<SkuLookupInputDto, SkuDetailsDto> {
  constructor(
    private readonly catalogInventoryService: CatalogInventoryService,
    private readonly executionContext: ExecutionContext,
  ) {}

  run({ sku }: SkuLookupInputDto): Promise<SkuDetailsDto> {
    void this.executionContext.step.idempotencyKey;
    return this.catalogInventoryService.lookup(sku);
  }
}
