/**
 * Way B against the real @playwright/mcp server (behind the example's guarded launcher, started by
 * `@McpServer` over stdio — `real: [PlaywrightServer]`), a real headless Chromium and the local
 * site (agbossjs/agboss#1261): the typed subset reads a page, the same allowlist refuses what is not
 * listed — through the tool and in the server's own browser, redirects included — and the form is
 * filed once.
 */
import { describe, expect } from "vitest";
import { callTool, replyWith, testWith } from "@agboss/core/testing";
import { McpWebAgent } from "../src/agents/mcp-web.agent.js";
import { BrowserPlaywrightApplication } from "../src/browser-playwright.application.js";
import { OpenPageViaMcp } from "../src/mcp/open-page.mcp.js";
import { PlaywrightServer } from "../src/mcp/playwright.server.js";
import { SubmitContactViaMcp } from "../src/mcp/submit-contact.mcp.js";
import { SiteFault } from "../src/site/contact-site.js";
import { McpAskWorkflowStart } from "../src/workflows/mcp-web/mcp-ask.workflow-start.js";
import { siteForFile } from "./support/site.js";

const { site, running } = siteForFile();
const test = testWith(BrowserPlaywrightApplication, { real: [PlaywrightServer], allowNetwork: ["127.0.0.1"] });

const secretRequests = (): string[] => site().requests.filter((request) => request.endsWith("/secret"));
const posts = (): number => site().requests.filter((request) => request === "POST /contact").length;
const REQUEST = { reference: "mcp-callback-1", name: "Grace", email: "grace@example.com", message: "Do you have an annual plan?" };

describe("way B reads a page through @playwright/mcp", () => {
  test("open-page-mcp-tool: the title and the page", async ({ app }) => {
    const result = await app.tool(OpenPageViaMcp).invoke({ url: `${running().origin}/pricing` });

    expect(result).toMatchObject({ kind: "ok", value: { title: "Pricing", text: expect.stringContaining("Starter 12 USD") as string } });
  });

  test("two calls at once (a model may issue several in one turn) take turns on the server's one page", async ({ app }) => {
    const [pricing, home] = await Promise.all([
      app.tool(OpenPageViaMcp).invoke({ url: `${running().origin}/pricing` }),
      app.tool(OpenPageViaMcp).invoke({ url: `${running().origin}/` }),
    ]);

    expect(pricing).toMatchObject({ kind: "ok", value: { title: "Pricing" } });
    expect(home).toMatchObject({ kind: "ok", value: { title: "Acme Desk" } });
  });

  test("a model run: the agent opens the page with the MCP tool and answers", async ({ app, mockLlm }) => {
    mockLlm(McpWebAgent).thenReturn(callTool(OpenPageViaMcp, { url: `${running().origin}/pricing` }), replyWith("Starter is 12 USD"));

    const result = await app.execute(McpAskWorkflowStart, { text: "what does Starter cost?" });

    expect(result.toolCalls.map((call) => call.status)).toEqual(["succeeded"]);
    expect(result.output).toEqual({ text: "Starter is 12 USD" });
  });
});

describe("the same allowlist, checked before the server is asked", () => {
  test.for([
    ["127.0.0.1", (): string => `${site().loopbackUrl}/secret`],
    ["the cloud metadata address", (): string => "http://169.254.169.254/latest/meta-data/"],
    ["a LAN address", (): string => "http://192.168.0.1/admin"],
  ] as const)("the tool refuses %s", async ([, url], { app }) => {
    const result = await app.tool(OpenPageViaMcp).invoke({ url: url() });

    expect(result).toMatchObject({ kind: "error", message: expect.stringContaining("is not an allowed origin") as string });
    expect(secretRequests()).toEqual([]);
  });
});

describe("way B files the form once", () => {
  test("a lost answer (502 after the site filed the ticket): the model's next call looks it up and files nothing new", async ({ app, mockLlm }) => {
    const before = { tickets: site().tickets.length, posts: posts() };
    site().inject(SiteFault.BadGatewayAfterProcessing);
    mockLlm(McpWebAgent).thenReturn(
      callTool(SubmitContactViaMcp, REQUEST), // the answer is lost: an error result, the ticket is filed
      callTool(SubmitContactViaMcp, REQUEST), // the model tries again: reconcile finds it
      callTool(SubmitContactViaMcp, REQUEST), // and once more: the stored result is replayed
      replyWith("filed"),
    );

    const result = await app.execute(McpAskWorkflowStart, { text: "file my request" });

    expect(result.toolCalls.map((call) => call.status)).toEqual(["failed", "succeeded", "succeeded"]);
    expect(result.toolCalls[2]?.output).toEqual(result.toolCalls[1]?.output);
    expect(site().tickets).toHaveLength(before.tickets + 1);
    expect(posts()).toBe(before.posts + 1);
  });
});
