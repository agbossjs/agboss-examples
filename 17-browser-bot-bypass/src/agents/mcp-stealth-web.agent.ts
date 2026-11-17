import { Agent } from "@agboss/core";
import { OpenPageStealthViaMcp } from "../mcp/open-page-stealth.mcp.js";

/** Way B: an agent whose tool calls the example's own MCP server around the stealth browser. */
@Agent({
  name: "mcp-stealth-web-agent",
  description: "Reads allowed web pages in a real, headed Chrome, through an MCP server",
  prompt: "You read web pages for the user with open-page-stealth-mcp-tool. Answer in two sentences.",
  model: "openai/gpt-4.1-nano",
  tools: [OpenPageStealthViaMcp],
})
export class McpStealthWebAgent {}
