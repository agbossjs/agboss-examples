# `17-browser-bot-bypass` — A Real Chrome Behind an Allowlist, Tested Without Chrome

> **Priority:** P1 — a stealth browser plugged into an agent, two ways
> **Principle:** Promise → Failure Injection → Reproducible Proof

> **Independent example, not affiliated.** The stealth helper is
> [`greekr4/playwright-bot-bypass`](https://github.com/greekr4/playwright-bot-bypass) (MIT, version 2.2.2,
> commit `26efbdea`, read 2026-11-17), vendored with its license — see [`NOTICE`](./NOTICE) — over
> [`rebrowser-playwright`](https://www.npmjs.com/package/rebrowser-playwright) 1.64.102 (Apache-2.0).
> AGBoss is not affiliated with, endorsed by or sponsored by their authors.

## 1. Read this before you use it

- **It needs real Google Chrome and a display.** The helper launches `channel: 'chrome'`, headed:
  that is where its stealth comes from (a genuine user agent, GPU and plugins). On a server that means
  Xvfb (or a desktop session); it does **not** run on serverless platforms, and a headless or
  Chromium-only run is not what it promises.
- **It does not beat IP reputation, rate limits or CAPTCHA.** Its own README says so. It hides the tells
  of automation (the CDP `Runtime.enable` leak, Playwright's `window.__pwInitScripts`); a site that
  blocks your IP, throttles you or shows a challenge still does.
- **Authorized use only.** Use it for QA, accessibility testing and research on sites you own or are
  permitted to test. **You are responsible for the target sites' terms of service, `robots.txt` and the
  law.** Do not use it to bypass paywalls, abuse rate limits or scrape against a site's wishes.
- **The browser has its own network, outside AGBoss's A2A SSRF guard** (that guards the server's file
  fetches, not a browser). A model driving it can be sent to `127.0.0.1`, to `169.254.169.254` or to your
  LAN. Hence the allowlist: `BROWSER_ALLOWED_ORIGINS`, two layers (the context's route and the browser's
  resolver rules), on both ways. It is the rule of this example, not a property of the plugin.

## 2. The two ways

| | Way A — a `@Tool` (`stealth-workflow`) | Way B — an MCP server (`mcp-stealth-workflow`) |
|---|---|---|
| Browser | one shared stealth browser per application, injected through `deps`, closed by `onDestroy` | the example's own tiny MCP server (the plugin ships none) in a child process, started by `@McpServer` over stdio |
| Tool the model sees | `open-page-stealth-tool` | `open-page-stealth-mcp-tool` → the server's `open_page` |
| Where the browser comes from | the `BrowserFactory` role: `ChromeBrowserFactory` (the vendored `createStealthBrowser`) or the fake | the same role, chosen at the server's start (`--fake` or Chrome) |

```ts
// the role the application asks for; the real Chrome and the fake both implement it
export abstract class BrowserFactory { abstract launch(options: LaunchOptions): Promise<PortBrowser>; }

@Injectable({ deps: [ApplicationContext, BrowserFactory] })
export class StealthBrowser implements OnDestroy {   // `deps: [StealthBrowser]` in the tool
  onDestroy(): Promise<void> { return this.handle.close(); }
}
```

## 3. Engineering Promises Tested

| Promise | Threat / Failure Injected | AGBoss Mechanism | Executable Proof |
|---|---|---|---|
| **CI needs no Chrome, no display, no internet** | — | the `BrowserFactory` role replaced by `FakeBrowserFactory` (`BROWSER_FACTORY=fake`; `override(BrowserFactory, …)` in a test); the MCP server's child follows with `--fake` | every test below; [`tests/demo.test.ts`](./tests/demo.test.ts) |
| **The real launch is what the README says** | — | `rebrowser-playwright` replaced by a recorder: real Chrome (`channel: 'chrome'`), headed, the automation flag off, the allowlist's resolver rules, one init script that touches nothing on `navigator`, `--no-sandbox` opt-in | [`tests/vendor.test.ts`](./tests/vendor.test.ts) |
| **The model cannot open 127.0.0.1, the metadata address, the LAN, a file, another host** | those URLs | the tool refuses before a browser is launched; the context's `route` checks every request by exact origin (another port or scheme of a listed host included) and follows redirects by hand, each `Location` checked before it is requested; the resolver rules (in the launch arguments) are defence in depth | [`tests/allowlist.test.ts`](./tests/allowlist.test.ts), [`tests/wiring.test.ts`](./tests/wiring.test.ts) (the fake runs the installed route on every navigation) |
| **Way B has the same allowlist in the server's own browser** | the same URLs asked of the server directly | the server calls the same `readPage`/`BrowserHandle` | [`tests/mcp.test.ts`](./tests/mcp.test.ts) (the MCP SDK's client, no tool of ours in between) |
| **One browser, a context per call, closed when the app stops** | many calls; `app.close()`; a launch that failed | `StealthBrowser.onDestroy`; a failed launch is not kept | [`tests/wiring.test.ts`](./tests/wiring.test.ts) |
| **Timeouts and cancellation are honoured** | a page that never answers | the tool's `timeout` on the application's clock; the call's `AbortSignal` closes its context | [`tests/wiring.test.ts`](./tests/wiring.test.ts) |

## 4. Commands

```bash
npm ci
npm run demo       # offline, $0, a fake browser: both ways read a page, 127.0.0.1 is refused, the browser closes with the app
npm test           # the same, asserted
npm run check      # agboss check --strict --cassettes + tsc + eslint
npm run demo:live  # the manual run of §5: real Chrome, a display, a cheap model
```

Pinned exactly: `rebrowser-playwright@1.64.102`, `@modelcontextprotocol/sdk@1.32.2`, `zod@4.6.7`. The helper
is vendored (the package is not on npm) in `src/vendor/stealth-browser.ts`, with the changes listed in its
header: TypeScript, a context of its own per call (`newStealthContext`), extra launch arguments.

## 5. The manual live run

Not in CI. On a machine with Google Chrome and a display:

```bash
OPENROUTER_API_KEY=… npm run demo:live    # BROWSER_ALLOWED_ORIGINS defaults to https://example.org
```

Chrome opens headed (twice: Way A's browser, then the MCP server's), a cheap model (`openai/gpt-4.1-nano`)
reads `https://example.org/`, `127.0.0.1` is refused, the browsers close when the application stops. Run on
2026-11-17 on macOS with Chrome and OpenRouter: see the PR description for the output. Live, the demo
checks nothing — a real site and a real model are not reproducible.

## 6. Layout

```
src/vendor/stealth-browser.ts            the vendored MIT helper (createStealthBrowser, newStealthContext)
src/browser/browser-factory.ts           the role; chrome-browser.factory.ts is the real one, src/fake/ the fake
src/browser/browser-handle.ts            lazy launch, a context per call, abort, close once
src/browser/origin-allowlist.ts          isAllowedUrl, resolverRulesOf, parseAllowlist
src/browser/stealth-browser.service.ts   the @Injectable that owns the handle (onDestroy)
src/tools/open-page-stealth.tool.ts      Way A
src/mcp/stealth-browser.server-main.ts   Way B's server (the MCP SDK's McpServer, one tool)
src/mcp/stealth-browser.server.ts        @McpServer over stdio; open-page-stealth.mcp.ts the @McpTool
```

## 7. Guarantee Boundary

- **The allowlist checks the name in the URL, not the address behind it**; a listed name that resolves to a
  private address is not caught. For a browser that must not reach your network at all, add an egress
  proxy or a network policy. The route is the check (exact origin, every hop of a redirect, followed by hand because
  Playwright does not route the hops the browser follows itself — `16-browser-playwright` shows it
  against a real Chromium, with a meta refresh and a script navigation too); the resolver rules are
  defence in depth, by host name. Here the route is tested against the fake (which models a redirect as
  a `302` the route fetches), the resolver rules as launch arguments; against real Chrome both are the
  manual run's.
- **What the tests do not prove**: that real Chrome with these patches passes a given detector. The helper
  measured that itself on 2026-06-10 and 2026-08-27 on macOS; detectors change.
- **What stays yours**: which origins to list, the Chrome and display, the sites' terms, and the law.
