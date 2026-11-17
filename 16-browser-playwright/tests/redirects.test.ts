/**
 * Why the allowlist is two layers (agbossjs/agboss#1261). Playwright's `context.route` — the layer
 * the examples' first draft had alone — is not called for the hops of a redirect it lets through: a
 * listed page that answers 302 to 127.0.0.1 reaches the loopback server. The browser's resolver rules
 * (`resolverRulesOf`) refuse that hop. This test records the first fact; if a Playwright release
 * changes it, this test goes red and the README's sentence is to be rewritten, not the guard removed.
 */
import { afterAll, describe, expect, it } from "vitest";
import { chromium, type Browser } from "playwright";
import { guardContext } from "../src/browser/origin-allowlist.js";
import { siteForFile } from "./support/site.js";

const { site, running } = siteForFile();
let browser: Browser | undefined;

afterAll(async () => {
  await browser?.close();
});

describe("context.route alone", () => {
  it("does not see a redirect's next hop: the listed page sends the browser to 127.0.0.1 and it arrives", async () => {
    browser = await chromium.launch({
      headless: true,
      args: ["--host-resolver-rules=MAP shop.test 127.0.0.1"], // the name → the site, nothing else limited
    });
    const refused: string[] = [];
    const context = await browser.newContext();
    await guardContext(context, [running().origin], (url) => refused.push(url));
    const page = await context.newPage();

    await page.goto(`${running().origin}/go/loopback`);

    expect(page.url()).toBe(`${site().loopbackUrl}/secret`); // the hop was not refused…
    expect(site().requests).toContain("GET /secret"); // …and the server answered it
    expect(refused).toEqual([]);
  });
});
