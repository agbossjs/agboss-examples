import {
  HopsLimitExceededError,
  MeshLoopDetectedError,
  Workflow,
  start,
  toFinish,
} from "agboss";
import { BillingA2AAgent } from "../a2a/billing.a2a-agent.js";
import { TriageAgent } from "../agents/triage/triage.agent.js";
import { TriageRequestDto } from "../dto/triage-request.dto.js";
import { TriageResponseDto } from "../dto/triage-response.dto.js";
import { CatalogMcpServer } from "../mcp/catalog.mcp-server.js";
import { MeshLoopFallbackWorkflowFinish } from "../workflow-finishes/mesh-loop-fallback.workflow-finish.js";
import { TriageWorkflowFinish } from "../workflow-finishes/triage.workflow-finish.js";
import { TriageWorkflowStart } from "../workflow-starts/triage.workflow-start.js";

@Workflow({
  name: "triage-workflow",
  version: "1.0.0",
  flow: [
    start(TriageWorkflowStart)
      .returns(TriageRequestDto)
      .toAgent(TriageAgent)
      .onError(MeshLoopDetectedError, toFinish(MeshLoopFallbackWorkflowFinish))
      .onError(HopsLimitExceededError, toFinish(MeshLoopFallbackWorkflowFinish))
      .returns(TriageResponseDto)
      .toFinish(TriageWorkflowFinish),
  ],
  maxSteps: 6,
  mcp: [CatalogMcpServer],
  providers: [BillingA2AAgent],
})
export class TriageWorkflow {}
