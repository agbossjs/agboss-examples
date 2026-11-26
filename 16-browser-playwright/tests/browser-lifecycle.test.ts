/**
 * One shared browser per application, closed when the application stops (agbossjs/agboss#1261): the
 * tools get it through `deps`, never launch or close it; each call gets a context of its own and
 * closes it however it ends — a result, an error, a timeout, a cancelled run.
 */
import { describe, expect, it } from "vitest";
import { callTool, replyWith, testWith } from "@agboss/core/testing";
import { seconds } from "@agboss/core/units";
import { BrowserHandle } from "../src/browser/browser-handle.js";
import { SharedBrowser } from "../src/browser/shared-browser.service.js";
import { BrowserPlaywrightApplication } from "../src/browser-playwright.application.js";
import { WebAgent } from "../src/agents/web.agent.js";
import { AskWorkflowStart } from "../src/workflows/web/ask.workflow-start.js";
import { OpenPage } from "../src/tools/open-page.tool.js";
import { siteForFile } from "./support/site.js";
import { invoked } from "./support/steps.js";


const { site, running } = siteForFile();
const HOST_MAP = "MAP shop.test 127.0.0.1";
const test = testWith(BrowserPlaywrightApplication, { allowNetwork: ["127.0.0.1"] });

describe("the shared browser", () => {
  test("many calls, one Chromium; the contexts of the calls are all closed", async ({ app }) => {
    await app.ready();
    const { handle } = app.resolve(SharedBrowser);
    const url = `${running().origin}/pricing`;

    const results = await Promise.all([invoked(app, OpenPage, { url }), invoked(app, OpenPage, { url }), invoked(app, OpenPage, { url })]);
    await invoked(app, OpenPage, { url });

    expect(results.map((result) => result.kind)).toEqual(["ok", "ok", "ok"]);
    expect(handle.launches).toBe(1);
    expect(handle.activeContexts).toBe(0);
    expect(await handle.isOpen).toBe(true);
  });

  test("app.close() closes the browser; a call after it is refused, not relaunched", async ({ app }) => {
    await app.ready();
    const { handle } = app.resolve(SharedBrowser);
    await invoked(app, OpenPage, { url: `${running().origin}/pricing` });
    expect(await handle.isOpen).toBe(true);

    await app.close();

    expect(await handle.isOpen).toBe(false);
    await expect(handle.use(new AbortController().signal, () => Promise.resolve("never"))).rejects.toThrow(/application is stopping/u);
    expect(handle.launches).toBe(1);
  });

  test("an application that never browsed starts no browser and closes cleanly", async ({ app }) => {
    await app.ready();
    const { handle } = app.resolve(SharedBrowser);

    await app.close();

    expect(handle.launches).toBe(0);
    expect(await handle.isOpen).toBe(false);
  });
});

describe("timeouts and cancellation", () => {
  test("a page that never answers: the tool's 20 s timeout, on the application's clock, ends the call and closes its context", async ({ app, clock, mockModel }) => {
    await app.ready();
    const { handle } = app.resolve(SharedBrowser);
    mockModel(WebAgent).thenReturn(callTool(OpenPage, { url: `${running().origin}/slow` }), replyWith("the page did not answer"));
    const slowRequests = (): number => site().requests.filter((request) => request === "GET /slow").length;
    const before = slowRequests();

    const run = app.execute(AskWorkflowStart, { text: "open the slow page" });
    await until(() => slowRequests() > before);
    expect(handle.activeContexts).toBe(1);
    await clock.advance(seconds(21));
    const result = await run;

    expect(result.toolCalls[0]).toMatchObject({ status: "timed-out", error: { message: "timed out after 20 s" } });
    expect(result.output).toEqual({ text: "the page did not answer" });
    await until(() => handle.activeContexts === 0);
  });

  it("an aborted signal stops a call waiting on a slow site at once and closes its context", async () => {
    const handle = new BrowserHandle({
      allowedOrigins: [running().origin],
      hostRules: HOST_MAP,
    });
    const controller = new AbortController();
    const slowBefore = site().requests.filter((request) => request === "GET /slow").length;
    try {
      const call = handle.use(controller.signal, async (context) => {
        const page = await context.newPage();
        await page.goto(`${running().origin}/slow`, { timeout: 30_000 });
      });
      const settled = call.then(() => "finished", (error: unknown) => (error as Error).message);
      await until(() => site().requests.filter((request) => request === "GET /slow").length > slowBefore);

      controller.abort(new Error("the run was cancelled"));

      expect(await settled).toBe("the run was cancelled");
      expect(handle.activeContexts).toBe(0);
    } finally {
      await handle.close();
    }
  });

  it("a signal already aborted starts nothing", async () => {
    const handle = new BrowserHandle({ allowedOrigins: [running().origin] });
    const controller = new AbortController();
    controller.abort(new Error("cancelled before it began"));

    await expect(handle.use(controller.signal, () => Promise.resolve(1))).rejects.toThrow("cancelled before it began");

    expect(handle.launches).toBe(0);
  });
});

/** Until a condition holds (a short poll on the real clock: the page and the site are real). */
async function until(condition: () => boolean, ms = 10_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("the condition did not hold in time");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
