import { Workflow, start } from "agboss";
import { SkuDetailsDto } from "../../src/dto/sku-details.dto.js";
import { SkuLookupInputDto } from "../../src/dto/sku-lookup-input.dto.js";
import { LookupSkuAgent } from "../agents/lookup-sku/lookup-sku.agent.js";
import { CatalogInventoryService } from "../services/catalog-inventory.service.js";
import { CatalogWorkflowFinish } from "../workflow-finishes/catalog.workflow-finish.js";
import { CatalogWorkflowStart } from "../workflow-starts/catalog.workflow-start.js";

@Workflow({
  name: "catalog-workflow",
  version: "1.0.0",
  flow: [
    start(CatalogWorkflowStart)
      .returns(SkuLookupInputDto)
      .toAgent(LookupSkuAgent)
      .returns(SkuDetailsDto)
      .toFinish(CatalogWorkflowFinish),
  ],
  maxSteps: 4,
  providers: [CatalogInventoryService],
})
export class CatalogWorkflow {}
