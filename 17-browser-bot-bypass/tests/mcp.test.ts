/**
 * Way B against the example's own MCP server, started by `@McpServer` over stdio as a child process
 * with the fake browser (`--fake`): the typed `open_page` tool reads a page, the same allowlist
 * refuses what is not listed — in the tool and in the server's own browser — and the server exits
 * when its client goes away (agbossjs/agboss#1261).
 */
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { callTool, replyWith, testWith } from "@agboss/core/testing";
import { McpStealthWebAgent } from "../src/agents/mcp-stealth-web.agent.js";
import { BrowserBotBypassApplication } from "../src/browser-bot-bypass.application.js";
import { FAKE_WEB } from "../src/fake/fake-browser.factory.js";
import { OpenPageStealthViaMcp } from "../src/mcp/open-page-stealth.mcp.js";
import { StealthBrowserServer } from "../src/mcp/stealth-browser.server.js";
import { McpAskWorkflowStart } from "../src/workflows/mcp-stealth/mcp-ask.workflow-start.js";
import { invoked } from "./support/steps.js";

const PRICING = "https://docs.example.com/pricing";
const test = testWith(BrowserBotBypassApplication, { real: [StealthBrowserServer] });

describe("way B: the typed tool calls the example's own MCP server", () => {
  test("open-page-stealth-mcp-tool: the title and the page", async ({ app }) => {
    const result = await invoked(app, OpenPageStealthViaMcp, { url: PRICING });

    expect(result).toEqual({ kind: "ok", value: FAKE_WEB[PRICING] });
  });

  test("a model run: the agent opens the page with the MCP tool and answers", async ({ app, mockLlm }) => {
    mockLlm(McpStealthWebAgent).thenReturn(callTool(OpenPageStealthViaMcp, { url: PRICING }), replyWith("Starter is 12 USD"));

    const result = await app.execute(McpAskWorkflowStart, { text: "what does Starter cost?" });

    expect(result.toolCalls.map((call) => call.status)).toEqual(["succeeded"]);
    expect(result.output).toEqual({ text: "Starter is 12 USD" });
  });

  test.for([
    ["127.0.0.1", "http://127.0.0.1:8080/admin"],
    ["the cloud metadata address", "http://169.254.169.254/latest/meta-data/"],
    ["a LAN address", "http://192.168.0.1/admin"],
  ] as const)("the tool refuses %s before the server is asked", async ([, url], { app }) => {
    const result = await invoked(app, OpenPageStealthViaMcp, { url });

    expect(result).toMatchObject({ kind: "error", message: expect.stringContaining("is not an allowed origin") as string });
  });
});

describe("the server's own browser, spoken to with the MCP SDK's client (no tool of ours in between)", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "src/scripts/stealth-browser.server-main.ts", "--fake"],
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: { ...(process.env as Record<string, string>), BROWSER_ALLOWED_ORIGINS: "https://docs.example.com" },
      stderr: "inherit",
    });
    client = new Client({ name: "server-test", version: "1.0.0" });
    await client.connect(transport);
  }, 60_000);

  afterAll(async () => {
    await client.close();
  });

  const openPage = (url: string) => client.callTool({ name: "open_page", arguments: { url } });
  const textOf = (result: Awaited<ReturnType<typeof openPage>>): string =>
    (result.content as { text?: string }[]).map((part) => part.text ?? "").join("");

  it("offers one tool: open_page", async () => {
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(["open_page"]);
  });

  it("reads a listed page", async () => {
    const result = await openPage(PRICING);

    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toEqual(FAKE_WEB[PRICING]);
  });

  it.each(["http://127.0.0.1:8080/admin", "http://169.254.169.254/latest/meta-data/", "file:///etc/hosts", "https://evil.example.net/"])(
    "refuses %s inside the server",
    async (url) => {
      const result = await openPage(url);

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("is not an allowed origin");
    },
  );

  it("exits when its client goes away", async () => {
    const pid = transport.pid;
    expect(pid).not.toBeNull();

    await client.close();

    for (let waited = 0; waited < 10_000; waited += 100) {
      try {
        process.kill(pid ?? 0, 0);
      } catch {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect.unreachable("the server's process is still alive");
  });
});
