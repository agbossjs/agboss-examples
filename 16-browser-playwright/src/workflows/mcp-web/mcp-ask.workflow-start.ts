import { WorkflowStart } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";

@WorkflowStart({
  name: "mcp-ask-workflow-start",
  description: "A request the agent answers by browsing through the Playwright MCP server",
  input: WorkflowStartTextDto,
})
export class McpAskWorkflowStart {}
