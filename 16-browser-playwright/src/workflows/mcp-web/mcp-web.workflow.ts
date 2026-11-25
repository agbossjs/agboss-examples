import { Workflow, onStart, Ttl } from "@agboss/core";
import { McpWebAgent } from "../../agents/mcp-web.agent.js";
import { PlaywrightServer } from "../../mcp/playwright.server.js";
import { McpAnswerWorkflowFinish } from "./mcp-answer.workflow-finish.js";
import { McpAskWorkflowStart } from "./mcp-ask.workflow-start.js";

/** Way B: the official @playwright/mcp server, wired through `@McpServer` over stdio. */
@Workflow({
  name: "mcp-web-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [onStart(McpAskWorkflowStart)
.toAgent(McpWebAgent)
.toFinish(McpAnswerWorkflowFinish)],
  defaults: { models: { temperature: 0 } },
  providers: [PlaywrightServer],
})
export class McpWebWorkflow {}
