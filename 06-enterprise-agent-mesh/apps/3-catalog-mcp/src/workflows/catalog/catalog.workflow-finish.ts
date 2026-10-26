import { WorkflowFinish } from "@agboss/core";
import { SkuDetailsDto } from "../../dto/sku-details.dto.js";

@WorkflowFinish({
  name: "catalog-workflow-finish",
  description: "Returns the SKU details",
  output: SkuDetailsDto,
})
export class CatalogWorkflowFinish {}
