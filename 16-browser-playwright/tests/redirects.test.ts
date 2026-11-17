/**
 * Why a request is not simply `continue()`d (agbossjs/agboss#1261). Playwright's route is not called for
 * the hops of a redirect the browser follows by itself: a listed page that answers 302 to 127.0.0.1
 * reaches the loopback server. If a Playwright release changes this, this test goes red and the README's
 * sentence is to be rewritten, not the guard removed.
 */
import { afterAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { siteForFile } from "./support/site.js";

const { site, running } = siteForFile();
let browser: Browser | undefined;

afterAll(async () => {
  await browser?.close();
});

describe("a route that only continues", () => {
  it("does not see a redirect's next hop: the listed page sends the browser to 127.0.0.1 and it arrives", async () => {
    browser = await chromium.launch({ headless: true, args: ["--host-resolver-rules=MAP shop.test 127.0.0.1"] });
    const seen: string[] = [];
    const context = await browser.newContext();
    await context.route("**/*", async (route) => {
      seen.push(route.request().url());
      await route.continue();
    });
    const page = await context.newPage();

    await page.goto(`${running().origin}/go/loopback`);

    expect(page.url()).toBe(`${site().loopbackUrl}/secret`);
    expect(seen).toEqual([`${running().origin}/go/loopback`]); // the hop never reached the route
  });
});
