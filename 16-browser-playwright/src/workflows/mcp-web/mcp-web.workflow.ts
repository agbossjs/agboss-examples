import { Workflow, start } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";
import { McpWebAgent } from "../../agents/mcp-web.agent.js";
import { PlaywrightServer } from "../../mcp/playwright.server.js";
import { McpAnswerWorkflowFinish } from "./mcp-answer.workflow-finish.js";
import { McpAskWorkflowStart } from "./mcp-ask.workflow-start.js";

/** Way B: the official @playwright/mcp server, wired through `@McpServer` over stdio. */
@Workflow({
  name: "mcp-web-workflow",
  version: "1.0.0",
  flow: [start(McpAskWorkflowStart)
.returns(WorkflowStartTextDto)
.toAgent(McpWebAgent)
.toFinish(McpAnswerWorkflowFinish)],
  defaults: { models: { temperature: 0 } },
  mcp: [PlaywrightServer],
})
export class McpWebWorkflow {}
