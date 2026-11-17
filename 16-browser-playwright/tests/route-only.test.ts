/**
 * The route is the check (agbossjs/agboss#1261): by exact origin — scheme, host and port — for every
 * request, the hops of a redirect, a meta refresh and a script's navigation included. These run WITHOUT
 * the browser's resolver rules (only the test site's name → address map), so a pass is the route's,
 * not the defence in depth's. A sabotage of `guardContext` — `continue()` for everything, or no
 * `maxRedirects: 0` — turns them red.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { guardContext } from "../src/browser/origin-allowlist.js";
import { ContactSite } from "../src/site/contact-site.js";
import { siteForFile } from "./support/site.js";

const { site, running } = siteForFile();
const HOST_MAP = "MAP shop.test 127.0.0.1";
let browser: Browser;
let other: ContactSite;
let otherPort: string;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true, args: [`--host-resolver-rules=${HOST_MAP}`] });
  other = new ContactSite();
  otherPort = new URL(await other.start()).port;
});
afterAll(async () => {
  await browser.close();
  await other.stop();
});

async function guarded(allowed: readonly string[]): Promise<{ context: BrowserContext; refused: string[] }> {
  const refused: string[] = [];
  const context = await browser.newContext();
  await guardContext(context, allowed, (url) => refused.push(url), HOST_MAP);
  return { context, refused };
}

const secrets = (): string[] => [...site().requests, ...other.requests].filter((request) => request.endsWith("/secret"));

describe("exact origin, on the first request", () => {
  it("a listed page loads — a page and its form's POST pass through the route", async () => {
    const { context } = await guarded([running().origin]);
    const page = await context.newPage();

    await page.goto(`${running().origin}/pricing`);

    expect(await page.title()).toBe("Pricing");
    await context.close();
  });

  it("an allowed host on ANOTHER PORT is refused", async () => {
    const { context, refused } = await guarded([running().origin]);
    const page = await context.newPage();

    await expect(page.goto(`http://shop.test:${otherPort}/secret`)).rejects.toThrow(/ERR_BLOCKED_BY_CLIENT/u);

    expect(refused).toEqual([`http://shop.test:${otherPort}/secret`]);
    expect(secrets()).toEqual([]);
    await context.close();
  });

  it("an allowed host on ANOTHER SCHEME (https where http is listed) is refused", async () => {
    const { context, refused } = await guarded([running().origin]);
    const page = await context.newPage();

    await expect(page.goto(`https://shop.test:${new URL(running().origin).port}/`)).rejects.toThrow();

    expect(refused).toEqual([`https://shop.test:${new URL(running().origin).port}/`]);
    await context.close();
  });

  it("the loopback by its address is refused", async () => {
    const { context, refused } = await guarded([running().origin]);
    const page = await context.newPage();

    await expect(page.goto(`${site().loopbackUrl}/secret`)).rejects.toThrow(/ERR_BLOCKED_BY_CLIENT/u);

    expect(refused).toHaveLength(1);
    expect(secrets()).toEqual([]);
    await context.close();
  });
});

describe("every hop and every navigation after the first", () => {
  it.each([
    ["a redirect from an allowed origin to 127.0.0.1", "/go/loopback"],
    ["a redirect from an allowed origin to the cloud metadata address", "/go/metadata"],
    ["a chain: a listed page, then a listed redirect, then 127.0.0.1", "/go/chain"],
    ["a meta refresh to 127.0.0.1", "/meta"],
    ["a script's location change to 127.0.0.1", "/js"],
  ])("%s is refused at the hop, the server never sees it", async (_what, path) => {
    const { context, refused } = await guarded([running().origin]);
    const page = await context.newPage();

    await page.goto(`${running().origin}${path}`).catch(() => undefined);
    await page.waitForTimeout(500); // a meta refresh and a script move on their own

    expect(refused.length).toBeGreaterThan(0);
    expect(refused.every((url) => !url.startsWith(running().origin))).toBe(true);
    expect(page.url()).not.toContain("/secret");
    expect(secrets()).toEqual([]);
    await context.close();
  });

  it("a redirect to an allowed origin is followed (the page is shown at the URL asked)", async () => {
    const { context } = await guarded([running().origin]);
    const page = await context.newPage();

    await page.goto(`${running().origin}/go/pricing`);

    expect(await page.title()).toBe("Pricing");
    await context.close();
  });
});
