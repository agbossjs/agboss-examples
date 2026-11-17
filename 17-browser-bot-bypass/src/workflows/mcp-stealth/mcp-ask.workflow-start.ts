import { WorkflowStart } from "@agboss/core";
import { WorkflowStartTextDto } from "@agboss/core/dto";

@WorkflowStart({
  name: "mcp-ask-workflow-start",
  description: "A request the agent answers by reading allowed pages through the MCP server",
  input: WorkflowStartTextDto,
})
export class McpAskWorkflowStart {}
