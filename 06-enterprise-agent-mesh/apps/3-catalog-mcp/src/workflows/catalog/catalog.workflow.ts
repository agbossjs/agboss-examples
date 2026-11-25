import { Workflow, onStart, Ttl } from "@agboss/core";
import { LookupSkuAgent } from "../../agents/lookup-sku/lookup-sku.agent.js";
import { CatalogInventoryService } from "../../services/catalog-inventory.service.js";
import { CatalogWorkflowFinish } from "./catalog.workflow-finish.js";
import { CatalogWorkflowStart } from "./catalog.workflow-start.js";

@Workflow({
  name: "catalog-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(CatalogWorkflowStart)
      .toAgent(LookupSkuAgent)
      .toFinish(CatalogWorkflowFinish),
  ],
  executionLimits: { maxSteps: 4 },
  providers: [CatalogInventoryService],
})
export class CatalogWorkflow {}
