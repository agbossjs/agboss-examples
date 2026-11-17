/**
 * Way A's wiring against the fake browser factory (agbossjs/agboss#1261) — no Chrome, no display, no
 * internet: the tool reads a page through the shared browser the `BrowserFactory` role gave the
 * application; one browser serves every call, each call has a context of its own and closes it; the
 * allowlist refuses what is not listed before a browser is launched and again at the context's route;
 * the browser is closed when the application stops; a launch that failed is tried again.
 */
import { describe, expect, it } from "vitest";
import { callTool, override, replyWith, testWith } from "@agboss/core/testing";
import { seconds } from "@agboss/core/units";
import { StealthWebAgent } from "../src/agents/stealth-web.agent.js";
import { BrowserBotBypassApplication } from "../src/browser-bot-bypass.application.js";
import { BrowserFactory } from "../src/browser/browser-factory.js";
import { BrowserHandle } from "../src/browser/browser-handle.js";
import { StealthBrowser } from "../src/browser/stealth-browser.service.js";
import { FAKE_WEB, FakeBrowserFactory, SLOW_URL } from "../src/fake/fake-browser.factory.js";
import { OpenPageStealth } from "../src/tools/open-page-stealth.tool.js";
import { AskWorkflowStart } from "../src/workflows/stealth/ask.workflow-start.js";

const PRICING = "https://docs.example.com/pricing";
const test = testWith(BrowserBotBypassApplication, { overrides: [override(BrowserFactory, FakeBrowserFactory)] });

const fakeOf = (app: { resolve: <T>(token: abstract new (...args: never[]) => T) => T }): FakeBrowserFactory => {
  const factory = app.resolve(BrowserFactory);
  if (!(factory instanceof FakeBrowserFactory)) throw new Error("the test runs on the fake browser");
  return factory;
};

describe("the tool reads a page through the shared browser", () => {
  test("the page's title and text; the browser launched once with the allowlist's resolver rules", async ({ app }) => {
    await app.ready();

    const result = await app.tool(OpenPageStealth).invoke({ url: PRICING });

    expect(result).toEqual({ kind: "ok", value: FAKE_WEB[PRICING] });
    const { record } = fakeOf(app);
    expect(record.launches).toEqual([{ launchArgs: ["--host-resolver-rules=EXCLUDE docs.example.com, MAP * ~NOTFOUND"] }]);
    expect(record.navigations).toEqual([{ url: PRICING, allowed: true }]);
  });

  test("many calls, one browser; every call's context is closed and guarded by a route", async ({ app }) => {
    await app.ready();

    await Promise.all([1, 2, 3].map(() => app.tool(OpenPageStealth).invoke({ url: PRICING })));
    await app.tool(OpenPageStealth).invoke({ url: PRICING });

    const { record } = fakeOf(app);
    expect(record.launches).toHaveLength(1);
    expect(record.contextsOpened).toBe(4);
    expect(record.contextsClosed).toBe(4);
    expect(record.routes).toBe(4);
    expect(app.resolve(StealthBrowser).handle.activeContexts).toBe(0);
  });

  test("a model run: the agent opens the page with the tool and answers", async ({ app, mockLlm }) => {
    mockLlm(StealthWebAgent).thenReturn(callTool(OpenPageStealth, { url: PRICING }), replyWith("Starter is 12 USD"));

    const result = await app.execute(AskWorkflowStart, { text: "what does Starter cost?" });

    expect(result.toolCalls.map((call) => call.status)).toEqual(["succeeded"]);
    expect(result.output).toEqual({ text: "Starter is 12 USD" });
  });
});

describe("the allowlist", () => {
  test.for([
    ["127.0.0.1", "http://127.0.0.1:8080/admin"],
    ["localhost", "http://localhost:3000/"],
    ["the cloud metadata address", "http://169.254.169.254/latest/meta-data/"],
    ["a LAN address", "http://192.168.0.1/admin"],
    ["a file", "file:///etc/hosts"],
    ["another host", "https://evil.example.net/"],
    ["a listed host on another scheme", "http://docs.example.com/pricing"],
  ] as const)("the tool refuses %s before any browser is launched", async ([, url], { app }) => {
    await app.ready();

    const result = await app.tool(OpenPageStealth).invoke({ url });

    expect(result).toMatchObject({ kind: "error", message: expect.stringContaining("is not an allowed origin") as string });
    expect(fakeOf(app).record.launches).toHaveLength(0);
  });

  test("the context's route refuses what the tool's check does not see (the handle used directly)", async ({ app }) => {
    await app.ready();
    const refused: string[] = [];
    const { handle } = app.resolve(StealthBrowser);
    const guarded = new BrowserHandle(fakeOf(app), { allowedOrigins: ["https://docs.example.com"], onRefused: (url) => refused.push(url) });

    await expect(
      guarded.use(new AbortController().signal, async (context) => {
        const page = await context.newPage();
        await page.goto("http://169.254.169.254/latest/meta-data/");
      }),
    ).rejects.toThrow(/ERR_BLOCKED_BY_CLIENT/u);

    expect(refused).toEqual(["http://169.254.169.254/latest/meta-data/"]);
    expect(fakeOf(app).record.navigations.at(-1)).toEqual({ url: "http://169.254.169.254/latest/meta-data/", allowed: false });
    expect(handle.launches).toBe(0);
    await guarded.close();
  });
});

describe("the route is the check: exact origin, and every hop of a redirect", () => {
  const guarded = (app: Parameters<typeof fakeOf>[0], refused: string[] = []): BrowserHandle =>
    new BrowserHandle(fakeOf(app), { allowedOrigins: ["https://docs.example.com"], onRefused: (url) => refused.push(url) });
  const goto = (handle: BrowserHandle, url: string): Promise<string> =>
    handle.use(new AbortController().signal, async (context) => {
      const page = await context.newPage();
      await page.goto(url);
      return page.title();
    });

  test.for([
    ["a listed host on another port", "https://docs.example.com:8443/pricing"],
    ["a listed host on another scheme", "http://docs.example.com/pricing"],
    ["127.0.0.1", "http://127.0.0.1:8080/admin"],
  ] as const)("%s is refused by the route; the network is never asked", async ([, url], { app }) => {
    await app.ready();
    const refused: string[] = [];
    const handle = guarded(app, refused);

    await expect(goto(handle, url)).rejects.toThrow(/ERR_BLOCKED_BY_CLIENT/u);

    expect(refused).toEqual([url]);
    expect(fakeOf(app).record.fetched).toEqual([]);
    await handle.close();
  });

  test.for([
    ["a redirect to 127.0.0.1", "https://docs.example.com/go/loopback", ["https://docs.example.com/go/loopback"]],
    ["a redirect to the cloud metadata address", "https://docs.example.com/go/metadata", ["https://docs.example.com/go/metadata"]],
    ["a chain: a listed redirect, then 127.0.0.1", "https://docs.example.com/go/chain", ["https://docs.example.com/go/chain", "https://docs.example.com/go/loopback"]],
  ] as const)("%s is refused at the hop: only the listed hops are ever requested", async ([, url, hops], { app }) => {
    await app.ready();
    const refused: string[] = [];
    const handle = guarded(app, refused);

    await expect(goto(handle, url)).rejects.toThrow(/ERR_BLOCKED_BY_CLIENT/u);

    expect(fakeOf(app).record.fetched).toEqual(hops);
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatch(/^http:\/\/(127\.0\.0\.1|169\.254\.169\.254)/u);
    await handle.close();
  });

  test("a redirect to a listed page is followed", async ({ app }) => {
    await app.ready();
    const handle = guarded(app);

    expect(await goto(handle, "https://docs.example.com/go/pricing")).toBe("Pricing");

    expect(fakeOf(app).record.fetched).toEqual(["https://docs.example.com/go/pricing", "https://docs.example.com/pricing"]);
    await handle.close();
  });
});

describe("the browser's life", () => {
  test("app.close() closes the browser; a call after it is refused, not relaunched", async ({ app }) => {
    await app.ready();
    const { handle } = app.resolve(StealthBrowser);
    await app.tool(OpenPageStealth).invoke({ url: PRICING });
    expect(await handle.isOpen).toBe(true);

    await app.close();

    expect(await handle.isOpen).toBe(false);
    expect(fakeOf(app).record.closed).toBe(true);
    await expect(handle.use(new AbortController().signal, () => Promise.resolve("never"))).rejects.toThrow(/application is stopping/u);
    expect(handle.launches).toBe(1);
  });

  test("an application that never browsed launches no browser and closes cleanly", async ({ app }) => {
    await app.ready();

    await app.close();

    expect(fakeOf(app).record.launches).toHaveLength(0);
  });

  test("a launch that failed (no Chrome, no display) is an error result, and the next call launches again", async ({ app }) => {
    await app.ready();
    const factory = fakeOf(app);
    factory.failLaunchWith = new Error("Chrome is not installed");

    const failed = await app.tool(OpenPageStealth).invoke({ url: PRICING });
    factory.failLaunchWith = undefined;
    const recovered = await app.tool(OpenPageStealth).invoke({ url: PRICING });

    expect(failed).toMatchObject({ kind: "error", message: "Chrome is not installed" });
    expect(recovered.kind).toBe("ok");
    expect(app.resolve(StealthBrowser).handle.launches).toBe(2);
  });
});

describe("timeouts and cancellation", () => {
  test("a page that never answers: the tool's 30 s timeout, on the application's clock, ends the call and closes its context", async ({ app, clock, mockLlm }) => {
    await app.ready();
    const { handle } = app.resolve(StealthBrowser);
    mockLlm(StealthWebAgent).thenReturn(callTool(OpenPageStealth, { url: SLOW_URL }), replyWith("the page did not answer"));

    const run = app.execute(AskWorkflowStart, { text: "open the slow page" });
    await until(() => handle.activeContexts === 1);
    // in steps of the lease's renewal interval: one jump of 31 s would be this instance frozen that long
    for (let left = 31; left > 0; left -= 10) await clock.advance(seconds(Math.min(left, 10)));
    const result = await run;

    expect(result.toolCalls[0]).toMatchObject({ status: "timed-out", error: { message: "timed out after 30 s" } });
    expect(result.output).toEqual({ text: "the page did not answer" });
    await until(() => handle.activeContexts === 0);
  });

  it("an aborted signal stops a call waiting on a slow page at once and closes its context", async () => {
    const factory = new FakeBrowserFactory();
    const handle = new BrowserHandle(factory, { allowedOrigins: ["https://docs.example.com"] });
    const controller = new AbortController();
    const call = handle.use(controller.signal, async (context) => {
      const page = await context.newPage();
      await page.goto(SLOW_URL);
    });
    const settled = call.then(() => "finished", (error: unknown) => (error as Error).message);
    await until(() => handle.activeContexts === 1 && factory.record.navigations.length === 1);

    controller.abort(new Error("the run was cancelled"));

    expect(await settled).toBe("the run was cancelled");
    expect(handle.activeContexts).toBe(0);
    expect(factory.record.contextsClosed).toBe(1);
    await handle.close();
  });

  it("a signal already aborted starts nothing", async () => {
    const factory = new FakeBrowserFactory();
    const handle = new BrowserHandle(factory, { allowedOrigins: ["https://docs.example.com"] });
    const controller = new AbortController();
    controller.abort(new Error("cancelled before it began"));

    await expect(handle.use(controller.signal, () => Promise.resolve(1))).rejects.toThrow("cancelled before it began");

    expect(factory.record.launches).toHaveLength(0);
  });
});

/** Until a condition holds (a short poll on the real clock). */
async function until(condition: () => boolean, ms = 10_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("the condition did not hold in time");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
