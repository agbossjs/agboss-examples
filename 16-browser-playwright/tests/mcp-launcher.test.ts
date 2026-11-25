/**
 * The guarded launcher of the official @playwright/mcp server, spoken to with the MCP SDK's own
 * client (agbossjs/agboss#1261): the server's browser refuses 127.0.0.1, the metadata address and a
 * redirect hop to them — with no tool of ours in between, so the check is the server's browser's —
 * reads a listed page, and exits when its client goes away.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { siteForFile } from "./support/site.js";

const { site, running } = siteForFile();
const PROJECT = fileURLToPath(new URL("..", import.meta.url));

let client: Client;
let transport: StdioClientTransport;

beforeAll(async () => {
  transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "src/scripts/guarded-playwright.server.ts"],
    cwd: PROJECT,
    env: Object.fromEntries(Object.entries({ ...process.env, ...running().variables }).filter((entry): entry is [string, string] => entry[1] !== undefined)),
    stderr: "inherit",
  });
  client = new Client({ name: "launcher-test", version: "1.0.0" });
  await client.connect(transport);
}, 60_000);

afterAll(async () => {
  await client.close();
});

const navigate = (url: string) => client.callTool({ name: "browser_navigate", arguments: { url } });
const textOf = (result: Awaited<ReturnType<typeof navigate>>): string =>
  (result.content as { type: string; text?: string }[]).map((part) => part.text ?? "").join("");
const secretRequests = (): string[] => site().requests.filter((request) => request.endsWith("/secret"));

describe("the official server behind the guarded launcher", () => {
  it("offers its tools (the typed subset the application declares is a part of them)", async () => {
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(expect.arrayContaining(["browser_navigate", "browser_snapshot", "browser_evaluate"]));
  });

  it("reads a listed page", async () => {
    const result = await navigate(`${running().origin}/pricing`);

    expect(result.isError).not.toBe(true);
    expect(textOf(result)).toContain("Page Title: Pricing");
  });

  it.each([
    ["127.0.0.1", (): string => `${site().loopbackUrl}/secret`],
    ["the cloud metadata address", (): string => "http://169.254.169.254/latest/meta-data/"],
    ["a LAN address", (): string => "http://192.168.0.1/admin"],
  ])("refuses %s inside the server's browser", async (_what, url) => {
    const result = await navigate(url());

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/ERR_BLOCKED_BY_CLIENT|ERR_NAME_NOT_RESOLVED/u);
    expect(secretRequests()).toEqual([]);
  });

  it.each(["/go/loopback", "/go/metadata"])("a listed page that redirects the browser elsewhere (%s): the hop is refused", async (path) => {
    const result = await navigate(`${running().origin}${path}`);

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("ERR_BLOCKED_BY_CLIENT");
    expect(secretRequests()).toEqual([]);
  });
});

describe("the server's end", () => {
  it("exits when its client goes away", async () => {
    const pid = transport.pid;
    expect(pid).not.toBeNull();

    await client.close();

    const gone = async (): Promise<boolean> => {
      for (let waited = 0; waited < 10_000; waited += 100) {
        try {
          process.kill(pid ?? 0, 0);
        } catch {
          return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return false;
    };
    expect(await gone()).toBe(true);
  });
});
