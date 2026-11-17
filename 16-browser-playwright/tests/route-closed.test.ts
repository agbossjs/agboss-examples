/**
 * A context closed while the route is fetching (a call's timeout, a cancelled run, app.close()) must not
 * leave a rejection nobody handles: the request is aborted, nothing reaches the page, and the process
 * sees no `unhandledRejection` (agbossjs/agboss#1261). Without the catch in `guardContext` the
 * `route.fetch` of the closed context rejects into the process and these tests go red.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { guardContext } from "../src/browser/origin-allowlist.js";
import { siteForFile } from "./support/site.js";

const { site, running } = siteForFile();
const HOST_MAP = "MAP shop.test 127.0.0.1";
let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true, args: [`--host-resolver-rules=${HOST_MAP}`] });
});
afterAll(async () => {
  await browser.close();
});

describe("a context closed while the route is fetching", () => {
  it("aborts the request, delivers nothing to the page and raises no unhandled rejection", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      const context = await browser.newContext();
      await guardContext(context, [running().origin], () => undefined, HOST_MAP);
      const page = await context.newPage();
      const slowBefore = site().requests.filter((request) => request === "GET /slow").length;
      const navigation = page.goto(`${running().origin}/slow`, { timeout: 30_000 }).then(
        () => "loaded",
        (error: unknown) => (error as Error).message,
      );
      // the route is inside route.fetch: the site holds /slow and never answers
      for (let waited = 0; site().requests.filter((request) => request === "GET /slow").length <= slowBefore; waited += 20) {
        if (waited > 10_000) throw new Error("the route never fetched /slow");
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      await context.close();
      const outcome = await navigation;
      // give a rejection time to surface: the process reports it on a later tick
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(outcome).not.toBe("loaded"); // nothing reached the page
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("a fetch that fails for another reason (the site is down) is dropped the same way", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      const context = await browser.newContext();
      // the name maps to a port nobody listens on: route.fetch is refused
      await guardContext(context, ["http://shop.test:1"], () => undefined, HOST_MAP);
      const page = await context.newPage();

      await expect(page.goto("http://shop.test:1/", { timeout: 10_000 })).rejects.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 300));

      expect(unhandled).toEqual([]);
      await context.close();
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });
});
