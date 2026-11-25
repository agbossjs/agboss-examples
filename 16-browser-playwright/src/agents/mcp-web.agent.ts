import { Agent, inline } from "@agboss/core";
import { OpenPageViaMcp } from "../mcp/open-page.mcp.js";
import { SubmitContactViaMcp } from "../mcp/submit-contact.mcp.js";

/** Way B: an agent whose tools call the official Playwright MCP server (a typed subset of its tools). */
@Agent({
  name: "mcp-web-agent",
  description: "Reads allowed web pages and files contact requests through the Playwright MCP server",
  prompt: inline(
    "You browse for the user. Open pages with open-page-mcp-tool and send a message to the support desk with submit-contact-mcp-tool (one reference per request). Answer in two sentences.",
  ),
  model: "openai/gpt-4.1-nano",
  tools: [OpenPageViaMcp, SubmitContactViaMcp],
})
export class McpWebAgent {}
