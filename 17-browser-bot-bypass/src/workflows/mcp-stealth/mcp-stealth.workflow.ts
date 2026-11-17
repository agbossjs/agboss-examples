import { Workflow, start } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";
import { McpStealthWebAgent } from "../../agents/mcp-stealth-web.agent.js";
import { StealthBrowserServer } from "../../mcp/stealth-browser.server.js";
import { McpAnswerWorkflowFinish } from "./mcp-answer.workflow-finish.js";
import { McpAskWorkflowStart } from "./mcp-ask.workflow-start.js";

/** Way B: the example's own MCP server around the stealth browser, wired through `@McpServer` over stdio. */
@Workflow({
  name: "mcp-stealth-workflow",
  version: "1.0.0",
  flow: [start(McpAskWorkflowStart)
.returns(WorkflowStartTextDto)
.toAgent(McpStealthWebAgent)
.toFinish(McpAnswerWorkflowFinish)],
  defaults: { models: { temperature: 0 } },
  mcp: [StealthBrowserServer],
})
export class McpStealthWorkflow {}
