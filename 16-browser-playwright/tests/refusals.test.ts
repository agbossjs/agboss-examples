/**
 * Way A's allowlist against a real headless Chromium and the local site (agbossjs/agboss#1261): what
 * the model asks for outside the list is refused and the site never sees the request. The first
 * group goes through the tool (the URL check), the second through the browser itself (the route and
 * the resolver rules), the third is a listed page that sends the browser elsewhere — a redirect hop
 * only the resolver rules catch.
 */
import { afterEach, describe, expect } from "vitest";
import { testWith } from "@agboss/core/testing";
import { chromium } from "playwright";
import { BrowserHandle } from "../src/browser/browser-handle.js";
import { guardContext } from "../src/browser/origin-allowlist.js";
import { SharedBrowser } from "../src/browser/shared-browser.service.js";
import { BrowserPlaywrightApplication } from "../src/browser-playwright.application.js";
import { OpenPage } from "../src/tools/open-page.tool.js";
import { Screenshot } from "../src/tools/screenshot.tool.js";
import { siteForFile } from "./support/site.js";

const { site, running } = siteForFile();
const test = testWith(BrowserPlaywrightApplication, { allowNetwork: ["127.0.0.1"] });

const secretRequests = (): string[] => site().requests.filter((request) => request.endsWith("/secret"));

describe("the tool refuses a URL outside the list before the browser is asked", () => {
  test.for([
    ["127.0.0.1", (): string => `${site().loopbackUrl}/secret`],
    ["localhost", (): string => `${site().loopbackUrl.replace("127.0.0.1", "localhost")}/secret`],
    ["the cloud metadata address", (): string => "http://169.254.169.254/latest/meta-data/"],
    ["a LAN address", (): string => "http://192.168.0.1/admin"],
    ["a file", (): string => "file:///etc/hosts"],
  ] as const)("open-page-tool: %s", async ([, url], { app }) => {
    const result = await app.tool(OpenPage).invoke({ url: url() });

    expect(result).toMatchObject({ kind: "error", message: expect.stringContaining("is not an allowed origin") as string });
    expect(secretRequests()).toEqual([]);
    // nothing started a browser for a refused URL
    expect(app.resolve(SharedBrowser).handle.launches).toBe(0);
  });

  test("screenshot-tool refuses 127.0.0.1 the same way", async ({ app }) => {
    const result = await app.tool(Screenshot).invoke({ url: `${site().loopbackUrl}/secret` });

    expect(result).toMatchObject({ kind: "error", message: expect.stringContaining("is not an allowed origin") as string });
    expect(secretRequests()).toEqual([]);
  });

  test("a listed origin is opened", async ({ app }) => {
    const result = await app.tool(OpenPage).invoke({ url: `${running().origin}/pricing` });

    expect(result).toEqual({ kind: "ok", value: { title: "Pricing", text: expect.stringContaining("Starter 12 USD") as string } });
  });
});

describe("the browser itself refuses what the tool's check would miss", () => {
  const handles: BrowserHandle[] = [];
  afterEach(async () => {
    await Promise.all(handles.splice(0).map((handle) => handle.close()));
  });
  const handleOf = (onRefused: (url: string) => void): BrowserHandle => {
    const handle = new BrowserHandle({
      allowedOrigins: [running().origin],
      hostRules: "MAP shop.test 127.0.0.1",
      onRefused,
    });
    handles.push(handle);
    return handle;
  };

  test("a page that asks for 127.0.0.1 itself — navigation, then a subresource — is refused", async () => {
    const refused: string[] = [];
    const handle = handleOf((url) => refused.push(url));
    const context = await handle.openContext();
    const page = await context.newPage();

    await page.goto(`${running().origin}/`);
    const reached = await page.evaluate(`fetch(${JSON.stringify(`${site().loopbackUrl}/secret`)}).then(() => "reached", () => "refused")`);
    await expect(page.goto(`${site().loopbackUrl}/secret`)).rejects.toThrow();

    expect(reached).toBe("refused");
    expect(secretRequests()).toEqual([]);
    expect(refused.length).toBeGreaterThan(0);
  });

  test("the route alone refuses the first request of any page: the context guard", async () => {
    const refused: string[] = [];
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      await guardContext(context, [running().origin], (url) => refused.push(url));
      const page = await context.newPage();

      await expect(page.goto(`${site().loopbackUrl}/secret`)).rejects.toThrow(/ERR_BLOCKED_BY_CLIENT/u);

      expect(refused).toEqual([`${site().loopbackUrl}/secret`]);
      expect(secretRequests()).toEqual([]);
    } finally {
      await browser.close();
    }
  });
});

describe("a listed page that redirects the browser elsewhere", () => {
  test("to 127.0.0.1: the hop is refused, the site never sees /secret", async ({ app }) => {
    const result = await app.tool(OpenPage).invoke({ url: `${running().origin}/go/loopback` });

    expect(result.kind).toBe("error");
    expect(secretRequests()).toEqual([]);
    expect(site().requests).toContain("GET /go/loopback");
  });

  test("to the cloud metadata address: the hop is refused", async ({ app }) => {
    const result = await app.tool(OpenPage).invoke({ url: `${running().origin}/go/metadata` });

    expect(result).toMatchObject({ kind: "error", message: expect.stringContaining("ERR_BLOCKED_BY_CLIENT") as string });
  });
});
