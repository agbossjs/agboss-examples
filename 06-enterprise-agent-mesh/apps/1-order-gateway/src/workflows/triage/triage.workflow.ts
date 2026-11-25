import {
  HopsLimitExceededError,
  MeshLoopDetectedError,
  Workflow,
  onStart,
  toFinish,
  Ttl,
} from "@agboss/core";
import { BillingA2AAgent } from "../../a2a/billing.a2a-agent.js";
import { TriageAgent } from "../../agents/triage/triage.agent.js";
import { CatalogMcpServer } from "../../mcp/catalog.mcp-server.js";
import { MeshLoopFallbackWorkflowFinish } from "./mesh-loop-fallback.workflow-finish.js";
import { TriageWorkflowFinish } from "./triage.workflow-finish.js";
import { TriageWorkflowStart } from "./triage.workflow-start.js";

@Workflow({
  name: "triage-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(TriageWorkflowStart)
      .toAgent(TriageAgent)
      .onError(MeshLoopDetectedError, toFinish(MeshLoopFallbackWorkflowFinish))
      .onError(HopsLimitExceededError, toFinish(MeshLoopFallbackWorkflowFinish))
      .toFinish(TriageWorkflowFinish),
  ],
  executionLimits: { maxSteps: 6 },
  // an A2A client and an MCP server are providers like any service; the tools that call them reach them through `deps`
  providers: [BillingA2AAgent, CatalogMcpServer],
})
export class TriageWorkflow {}
