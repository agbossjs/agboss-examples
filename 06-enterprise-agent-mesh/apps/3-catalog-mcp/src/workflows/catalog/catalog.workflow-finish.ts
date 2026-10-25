import { WorkflowFinish } from "agboss";
import { SkuDetailsDto } from "../../dto/sku-details.dto.js";

@WorkflowFinish({
  name: "catalog-workflow-finish",
  description: "Returns the SKU details",
  output: SkuDetailsDto,
})
export class CatalogWorkflowFinish {}
