/**
 * What the model sees of the browser (agbossjs/agboss#1261): a page's text passes the application's
 * PII policy like any tool result; a screenshot reaches the model as an image part — a file the
 * agent opted in to with `files: ModelFiles.of({ sources: [FileSource.ToolResults] })` — never as
 * base64 text, and its bytes are not in the execution's records.
 */
import { describe, expect } from "vitest";
import { callTool, replyWith, testWith } from "@agboss/core/testing";
import { WebAgent } from "../src/agents/web.agent.js";
import { BrowserPlaywrightApplication } from "../src/browser-playwright.application.js";
import { BILLING_TEXT } from "../src/site/contact-site.js";
import { OpenPage } from "../src/tools/open-page.tool.js";
import { Screenshot } from "../src/tools/screenshot.tool.js";
import { AskWorkflowStart } from "../src/workflows/web/ask.workflow-start.js";
import { siteForFile } from "./support/site.js";

const { running } = siteForFile();
const test = testWith(BrowserPlaywrightApplication, { allowNetwork: ["127.0.0.1"] });

/** The first bytes of every PNG, base64: what a screenshot would leak if it travelled as text. */
const PNG_BASE64_PREFIX = "iVBORw0KGgo";

describe("a page's text passes the PII policy", () => {
  test("a card number on the page never reaches the model", async ({ app, mockLlm }) => {
    const agent = mockLlm(WebAgent).thenReturn(callTool(OpenPage, { url: `${running().origin}/billing` }), replyWith("read it"));

    const result = await app.execute(AskWorkflowStart, { text: "open the billing page" });

    expect(BILLING_TEXT).toContain("4111 1111 1111 1111");
    expect(result.toolCalls[0]?.status).toBe("succeeded");
    const seen = JSON.stringify(agent.requests.at(-1));
    expect(seen).toContain("Card on file");
    expect(seen).not.toContain("4111");
  });
});

describe("a screenshot is a file part", () => {
  test("the model receives an image part; no base64 in its text, the records or the tool call", async ({ app, mockLlm }) => {
    const agent = mockLlm(WebAgent).thenReturn(callTool(Screenshot, { url: `${running().origin}/` }), replyWith("I see the home page"));

    const result = await app.execute(AskWorkflowStart, { text: "screenshot the home page" });

    const [asked, answered] = agent.requests;
    expect(asked?.kind === "chat" ? asked.parts : []).toEqual([]);
    expect(answered?.kind === "chat" ? answered.parts : []).toEqual([expect.objectContaining({ mediaType: "image/png" })]);
    expect(JSON.stringify(agent.requests)).not.toContain(PNG_BASE64_PREFIX);
    expect(JSON.stringify([result.toolCalls, result.record])).not.toContain(PNG_BASE64_PREFIX);
    expect(result.toolCalls[0]?.output).toMatchObject({ screenshot: { mediaType: "image/png", filename: "page.png" } });
  });
});
