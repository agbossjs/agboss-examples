import { WorkflowStart } from "@agboss/core";
import { SkuLookupInputDto } from "../../dto/sku-lookup-input.dto.js";

@WorkflowStart({
  name: "catalog-workflow-start",
  description: "Looks up a SKU in the catalog workflow",
  input: SkuLookupInputDto,
})
export class CatalogWorkflowStart {}
