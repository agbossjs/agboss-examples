import { WorkflowFinish } from "agboss";
import { SkuDetailsDto } from "../../src/dto/sku-details.dto.js";

@WorkflowFinish({
  name: "catalog-workflow-finish",
  description: "Returns the SKU details",
  output: SkuDetailsDto,
})
export class CatalogWorkflowFinish {}
