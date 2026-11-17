/**
 * The vendored `createStealthBrowser` (MIT, playwright-bot-bypass) and the factory that wraps it, with
 * rebrowser-playwright replaced by a recorder: what Chrome would be launched with is read, no Chrome
 * is started. The claims of the README about the launch — real Chrome (`channel: 'chrome'`), headed,
 * the automation flag off, the allowlist's resolver rules, one init script that touches nothing on
 * `navigator` — are asserted here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const launches: Record<string, unknown>[] = [];
const contexts: { options: unknown; initScripts: { content: string }[]; closed: boolean }[] = [];
let browserClosed = false;

vi.mock("rebrowser-playwright", () => ({
  chromium: {
    launch: (options: Record<string, unknown>) => {
      launches.push(options);
      return Promise.resolve({
        newContext: (contextOptions: unknown) => {
          const context = { options: contextOptions, initScripts: [] as { content: string }[], closed: false };
          contexts.push(context);
          return Promise.resolve({
            addInitScript: (script: { content: string }) => {
              context.initScripts.push(script);
              return Promise.resolve();
            },
            newPage: () => Promise.resolve({ page: true }),
            close: () => {
              context.closed = true;
              return Promise.resolve();
            },
          });
        },
        close: () => {
          browserClosed = true;
          return Promise.resolve();
        },
        isConnected: () => !browserClosed,
      });
    },
  },
}));

beforeEach(() => {
  launches.length = 0;
  contexts.length = 0;
  browserClosed = false;
});

describe("createStealthBrowser (vendored)", () => {
  it("launches real Chrome, headed, with the automation flag off, one context and its page", async () => {
    const { createStealthBrowser } = await import("../src/vendor/stealth-browser.js");

    const { page } = await createStealthBrowser();

    expect(launches).toEqual([{ headless: false, channel: "chrome", args: ["--disable-blink-features=AutomationControlled"] }]);
    expect(contexts).toHaveLength(1);
    expect(contexts[0]?.options).toEqual({ viewport: { width: 1280, height: 800 } });
    expect(page).toEqual({ page: true });
  });

  it("the one init script strips Playwright's artifacts and touches nothing on navigator", async () => {
    const { createStealthBrowser } = await import("../src/vendor/stealth-browser.js");

    await createStealthBrowser();

    const [script] = contexts[0]?.initScripts ?? [];
    expect(contexts[0]?.initScripts).toHaveLength(1);
    expect(script?.content).toContain("__pw|pwInitScripts|playwright");
    expect(script?.content).not.toContain("navigator");
  });

  it("--no-sandbox is opt-in (it is itself a bot signal); more arguments are added after the original's", async () => {
    const { launchStealthBrowser } = await import("../src/vendor/stealth-browser.js");

    await launchStealthBrowser({ launchArgs: ["--x"] });
    await launchStealthBrowser({ noSandbox: true });

    expect(launches.map((launch) => launch.args)).toEqual([
      ["--disable-blink-features=AutomationControlled", "--x"],
      ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    ]);
  });
});

describe("ChromeBrowserFactory: the real factory behind the BrowserFactory role", () => {
  it("launches with the allowlist's resolver rules, gives each call a context of its own, closes once", async () => {
    const { ChromeBrowserFactory } = await import("../src/browser/chrome-browser.factory.js");

    const browser = await new ChromeBrowserFactory().launch({ launchArgs: ["--host-resolver-rules=EXCLUDE docs.example.com, MAP * ~NOTFOUND"] });
    const first = await browser.newContext();
    const second = await browser.newContext();
    await first.close();
    await browser.close();

    expect(launches[0]?.args).toEqual(["--disable-blink-features=AutomationControlled", "--host-resolver-rules=EXCLUDE docs.example.com, MAP * ~NOTFOUND"]);
    expect(contexts).toHaveLength(2);
    expect(contexts.map((context) => context.initScripts.length)).toEqual([1, 1]);
    expect(contexts.map((context) => context.closed)).toEqual([true, false]);
    expect(second).not.toBe(first);
    expect(browser.isConnected()).toBe(false);
  });
});
