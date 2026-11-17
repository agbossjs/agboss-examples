/**
 * Vendored from github.com/greekr4/playwright-bot-bypass (MIT), `skills/playwright-bot-bypass/scripts/stealth-template.mjs`
 * (package version 2.2.2, commit 26efbdea7370814467a8bac296fec6b3a4cdef2a, read 2026-11-17).
 *
 * MIT License
 *
 * Copyright (c) 2026 tae.virus
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Changes made here (the original is a plain ES module with a command-line demo):
 *   - converted to TypeScript, the init script kept as source text; `createStealthBrowser`'s behaviour is unchanged;
 *   - the context creation is split out as `newStealthContext(browser, options)`, so one launched
 *     browser can give each call a context of its own (cookies and storage are not shared between
 *     calls); `createStealthBrowser` is `launch` + `newStealthContext` + a page, as before;
 *   - a `launchArgs` option adds browser arguments (the example's resolver rules);
 *   - the human-typing and mouse helpers and the command-line demo are left out.
 *
 * What the original says about itself (kept): with `channel: 'chrome'` and headed mode, real Chrome
 * supplies a genuine User-Agent, WebGL/GPU renderer, canvas fingerprint and plugins; rebrowser-playwright
 * hides the CDP `Runtime.enable` tell; this adds only two things: it strips Playwright's main-world
 * artifacts (`window.__pwInitScripts`) and enables rebrowser's Runtime fix. It does NOT defeat IP-reputation,
 * behavioural or login walls, and it is for authorized use only: respect each site's terms of service,
 * robots.txt and applicable law.
 */
// rebrowser's Runtime.enable fix must be configured BEFORE the library is imported: default it to
// 'addBinding' unless the caller already set it, then import dynamically
process.env.REBROWSER_PATCHES_RUNTIME_FIX_MODE ??= "addBinding";
const { chromium } = await import("rebrowser-playwright");

type Browser = Awaited<ReturnType<typeof chromium.launch>>;
type BrowserContext = Awaited<ReturnType<Browser["newContext"]>>;
type Page = Awaited<ReturnType<BrowserContext["newPage"]>>;

/** What `createStealthBrowser` takes (the original's options, plus `launchArgs`). */
export interface StealthOptions {
  /** Headless is NOT stealth: the default is headed, as the original requires. */
  readonly headless?: boolean;
  readonly viewport?: { readonly width: number; readonly height: number };
  /** A custom user agent; the default is real Chrome's. */
  readonly userAgent?: string | null;
  /** The browser locale; null keeps real Chrome's languages (best stealth). */
  readonly locale?: string | null;
  /** A saved session's path (cookie persistence). */
  readonly storageState?: string | null;
  readonly proxy?: { readonly server: string; readonly username?: string; readonly password?: string } | null;
  /** `--no-sandbox`: needed for Linux root/CI, but itself a bot signal — off by default. */
  readonly noSandbox?: boolean;
  /** More browser arguments (added to the original's). */
  readonly launchArgs?: readonly string[];
}

/**
 * The init script (runs at document start) that removes Playwright's main-world signature objects.
 * Kept as source text, not as a function: a transpiler (tsx, esbuild's keepNames) may wrap a function's
 * inner helpers in calls that do not exist in the page, and Playwright sends a function as its source.
 */
const STRIP_PLAYWRIGHT_ARTIFACTS = `(() => {
  const hide = (key) => {
    try { delete window[key]; } catch { /* non-configurable */ }
    if (Object.prototype.hasOwnProperty.call(window, key)) {
      try { Object.defineProperty(window, key, { get: () => undefined, configurable: true }); } catch { /* sealed */ }
    }
  };
  for (const key of Object.getOwnPropertyNames(window)) {
    if (/^__pw|pwInitScripts|playwright/i.test(key)) hide(key);
  }
  // window.chrome's presence for the rare headless fallback (a no-op in real Chrome)
  if (!window.chrome) window.chrome = {};
})();`;

/** A context of its own on a stealth browser: the original's context options and its one init script. */
export async function newStealthContext(browser: Browser, options: StealthOptions = {}): Promise<BrowserContext> {
  const { viewport = { width: 1280, height: 800 }, userAgent = null, locale = null, storageState = null } = options;
  const contextOptions: Parameters<Browser["newContext"]>[0] = { viewport };
  if (locale !== null) contextOptions.locale = locale;
  if (userAgent !== null) contextOptions.userAgent = userAgent;
  if (storageState !== null) contextOptions.storageState = storageState;
  const context = await browser.newContext(contextOptions);
  // the ONLY init script: it touches nothing on navigator
  await context.addInitScript({ content: STRIP_PLAYWRIGHT_ARTIFACTS });
  return context;
}

/** Launches real Chrome (`channel: 'chrome'`) with rebrowser's patches: headed, for stealth. */
export async function launchStealthBrowser(options: StealthOptions = {}): Promise<Browser> {
  const { headless = false, proxy = null, noSandbox = false, launchArgs = [] } = options;
  const args = ["--disable-blink-features=AutomationControlled", ...launchArgs];
  // --no-sandbox is a security risk AND an automation signal; opt in only when the environment requires it
  if (noSandbox) args.push("--no-sandbox");
  return chromium.launch({ headless, channel: "chrome", args, ...(proxy === null ? {} : { proxy }) });
}

/** Creates a stealth browser instance: the browser, one context and one page (the original's factory). */
export async function createStealthBrowser(
  options: StealthOptions = {},
): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const browser = await launchStealthBrowser(options);
  const context = await newStealthContext(browser, options);
  const page = await context.newPage();
  return { browser, context, page };
}
