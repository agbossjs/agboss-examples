import { Agent, FileSource, FileView, ModelFiles } from "@agboss/core";
import { OpenPage } from "../tools/open-page.tool.js";
import { Screenshot } from "../tools/screenshot.tool.js";
import { SubmitContact } from "../tools/submit-contact.tool.js";

/** Way A: an agent whose tools drive the application's shared Chromium. */
@Agent({
  name: "web-agent",
  description: "Reads allowed web pages, looks at their screenshots and files contact requests",
  prompt:
    "You browse for the user. Open pages with open-page-tool, look at a page with screenshot-tool, and send a message to the support desk with submit-contact-tool (one reference per request). Answer in two sentences.",
  model: "openai/gpt-4.1-nano",
  tools: [OpenPage, Screenshot, SubmitContact],
  // a tool's file reaches the model as an image part, under the application's PII policies
  files: ModelFiles.of({ sources: [FileSource.ToolResults], views: [FileView.Original] }),
})
export class WebAgent {}
