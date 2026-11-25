# `16-browser-playwright` — A Browser an Agent Can Use, and Cannot Misuse

> **Priority:** P1 — a browser plugged into an agent, two ways
> **Principle:** Promise → Failure Injection → Reproducible Proof

> **Independent example, not affiliated.** Playwright and its MCP server are Microsoft's; they are
> named only to identify the public packages
> [`playwright`](https://www.npmjs.com/package/playwright) and
> [`@playwright/mcp`](https://www.npmjs.com/package/@playwright/mcp) (Apache-2.0), installed from npm at exact versions as
> read on 2026-11-17. AGBoss is not affiliated with, endorsed by or sponsored by Microsoft. "Acme Desk" is
> fictional: the local site under `src/site/` imitates no real service. Check the packages' docs before
> relying on this code.

A model that can browse is a model that can be sent anywhere — to `127.0.0.1`, to the cloud
metadata address `169.254.169.254`, to a router on your LAN — and one that can click is a model that
can submit a form twice. This example plugs a browser into an agent **two ways** on one application,
and shows the three things a browser needs before a model drives it:

- **a network rule it cannot talk its way past** — one allowlist of origins, on both ways;
- **an owner for its lifetime** — one shared browser per application, closed when the application stops;
- **a side effect filed once** — a form submitted through an outbound call keyed by the request's own
  reference, so a retry, a repeat and a crash do not file it twice.

| | Way A — a `@Tool` (this folder's `web-workflow`) | Way B — an MCP server (`mcp-web-workflow`) |
|---|---|---|
| Browser | plain Playwright, one headless Chromium per application, given to the tools through `deps` | the official `@playwright/mcp` server, started by `@McpServer` over stdio, with the browser in its own process |
| Tools the model sees | `open-page-tool`, `screenshot-tool`, `submit-contact-tool` | `open-page-mcp-tool`, `submit-contact-mcp-tool` — a typed subset of the server's ~25 tools |
| Screenshot | a file field: the model gets the image as a file part (#899), under the PII policies | not offered: the core's MCP bridge maps text, and an image is a file part only from a tool's file field |
| Closed when the app stops | `SharedBrowser.onDestroy` | the server exits when the application closes its stdio connection |

```ts
// Way A: the shared browser comes through deps; the tool never launches or closes it
@Tool({ name: "open-page-tool", input: PageRequestDto, output: PageTextDto, timeout: seconds(20),
        deps: [ExecutionContext, SharedBrowser] })
export class OpenPage implements ToolHandler<PageRequestDto, PageTextDto> {
  run({ url }: PageRequestDto): Promise<PageTextDto> {
    if (!isAllowedUrl(url, this.sharedBrowser.allowedOrigins)) return Promise.reject(new OriginRefusedError(url));
    // the call's signal: the tool's timeout and a cancelled run both close this call's context
    return this.sharedBrowser.handle.use(this.executionContext.signal, async (context) => { /* goto, read */ });
  }
}
```

## 1. Engineering Promises Tested

| Promise | Threat / Failure Injected | AGBoss Mechanism | Executable Proof |
|---|---|---|---|
| **The model cannot open 127.0.0.1, the metadata address or the LAN** | A URL for `127.0.0.1`, `localhost`, `169.254.169.254`, `192.168.x`, `file:`, another host, **another port or another scheme of a listed host** | the origin allowlist: the tool refuses before a browser is asked; the context's `route` checks **every request by exact origin** (scheme, host, port) — the first one and every subresource; the browser's resolver rules are defence in depth behind it | [`tests/allowlist.test.ts`](./tests/allowlist.test.ts), [`tests/route-only.test.ts`](./tests/route-only.test.ts) (the route alone, no resolver rules, a real Chromium), [`tests/refusals.test.ts`](./tests/refusals.test.ts) |
| **A listed page cannot send the browser elsewhere** | A redirect (and a chain of them) to `127.0.0.1` or `169.254.169.254`; a meta refresh and a script's `location = …` to `127.0.0.1` | the route follows redirects **by hand** (`route.fetch({ maxRedirects: 0 })`, each `Location` checked before it is requested) — **Playwright does not route a redirect's next hop** the browser follows itself, shown by [`tests/redirects.test.ts`](./tests/redirects.test.ts); a meta refresh and a script are new navigations and meet the route again | [`tests/route-only.test.ts`](./tests/route-only.test.ts) (the server never sees `/secret`) |
| **Way B has the same allowlist, in the server's own browser** | The same URLs asked of the MCP server directly, with no tool of ours in between | the guarded launcher of `@playwright/mcp` (`src/scripts/guarded-playwright.server.ts`): its documented `createConnection(config, contextGetter)` with a context guarded like Way A's — the server's own `--allowed-origins` "does not serve as a security boundary and does not affect redirects" (its README) | [`tests/mcp-launcher.test.ts`](./tests/mcp-launcher.test.ts), [`tests/mcp.test.ts`](./tests/mcp.test.ts) |
| **One browser per application, closed when it stops** | Many calls at once; `app.close()`; a call after it | `SharedBrowser` (`@Injectable`, `onDestroy`) owns a `BrowserHandle`; each call has a context of its own, closed in a `finally` | [`tests/browser-lifecycle.test.ts`](./tests/browser-lifecycle.test.ts) |
| **Timeouts and cancellation are honoured** | A page that never answers | the tool's `timeout` on the application's clock (`clock.advance`) and the call's `AbortSignal` close the call's context at once | [`tests/browser-lifecycle.test.ts`](./tests/browser-lifecycle.test.ts) |
| **A screenshot reaches the model as an image, under the PII policy** | The model reading base64 text, a card number on a page | a file field on the tool's output + `files: ModelFiles.of({ sources: [FileSource.ToolResults] })` (#899); `PiiFileAction.AllowOriginal` on the policy is the visible decision; a page's text passes `card-pii-policy` | [`tests/model-view.test.ts`](./tests/model-view.test.ts) |
| **The form is filed once** | The answer is lost (a proxy answers 502 after the ticket is filed); the model repeats the call; the customer submits again; a crash after the site filed the ticket | an outbound call keyed by `contact:<reference>` — an intent in a fenced write before the browser leaves, `recovery` (a lookup by key) after an unknown outcome, the stored result replayed | [`tests/submit-once.test.ts`](./tests/submit-once.test.ts) (a crash on two instances: the second recovers the run and files nothing new), [`tests/mcp.test.ts`](./tests/mcp.test.ts) |

## 2. Commands

```bash
npm ci
npm run browsers   # playwright install chromium — once; CI does it too
npm run demo       # both ways against the local site: read, look, file, refuse 127.0.0.1; the browser closes with the app
npm test           # the same, asserted; the allowlist, the redirects, the crash and the lifecycle
npm run check      # agboss check --strict --cassettes + tsc + eslint
```

Offline and $0: a headless Chromium against a site the demo and the tests start on `127.0.0.1`, the
models scripted — no key, no internet. The versions are pinned exactly: `playwright@1.66.0-alpha-2026-11-09`
(the one `@playwright/mcp@0.0.85` pins itself, so one copy is installed and one Chromium downloaded),
`@playwright/mcp@0.0.85`, `@modelcontextprotocol/sdk@1.32.2`.

## 3. Layout

```
src/browser/origin-allowlist.ts          the rule: isAllowedUrl, guardContext (the route), resolverRulesOf (the resolver)
src/browser/browser-handle.ts            the shared browser: lazy launch, a context per call, abort, close once
src/browser/shared-browser.service.ts    the @Injectable that owns it (onDestroy) — what the tools list in deps
src/tools/open-page.tool.ts              Way A: read a page
src/tools/screenshot.tool.ts             Way A: a PNG as a file field
src/tools/submit-contact.tool.ts         Way A: file the contact form — once per reference
src/services/contact-desk.service.ts     the outbound call around the form (both ways), `recovery` against the site's lookup
src/actions/submit-contact.action.ts     the same submit as a workflow step, for the crash tests
src/mcp/playwright.server.ts             Way B: @McpServer over stdio with the typed subset of @playwright/mcp's tools
src/scripts/guarded-playwright.server.ts     the process it starts: @playwright/mcp's createConnection on a guarded context
src/mcp/open-page.mcp.ts, submit-contact.mcp.ts   Way B: the tools that call the MCP server
src/site/contact-site.ts                 the local test site: pages, a form, a ticket lookup, redirects, faults
src/offline/offline-openrouter.ts        the demo's scripted OpenRouter wire
```

## 4. Guarantee Boundary

- **The allowlist checks the name in the URL, not the address behind it.** A listed hostname whose
  DNS record points at `10.0.0.5` is not caught: list names you trust, and for a browser that must not
  be able to reach your network at all, put it behind an egress proxy or a network policy — the
  allowlist is the application's layer, not a replacement for yours. The route is the check, by exact
  origin and on every hop; the resolver rules are defence in depth behind it (by host name only: they
  would let another port of a listed host resolve, the route does not). A redirected page is shown at
  the URL that was asked for, because the route answers the request with the chain's final response.
  WebSocket and other non-HTTP traffic is covered by the resolver rules only.
- **The browser has its own network**, outside AGBoss's A2A SSRF guard (that guards the server's file
  fetches, not a browser). `BROWSER_ALLOWED_ORIGINS` is the only rule on it. Never list `127.0.0.1`.
  The tests and the demo reach their local site by a name (`shop.test`) mapped to the loopback for the
  browser (`http://shop.test:<port>=127.0.0.1` in the variable) — a test-only form; a deployment lists
  plain origins.
- **What AGBoss guarantees**: the form's intent is recorded before the browser leaves and a lost
  answer is reconciled, never re-clicked blindly; a retry, a repeat, a second execution and the
  takeover of a crashed run file one ticket. This is an *outbound call* (a call to another system),
  not a fenced effect in the narrow sense — a fenced effect makes a write to the store's own database
  exactly-once in one transaction; a form on someone else's site cannot be in it (ADR-0026, ADR-0027).
- **What stays the site's**: the exactly-once rests on the site keeping one ticket per `reference`
  (here, as a payment API does per idempotency key) and answering a lookup by it. A site that does
  neither leaves an unknown outcome unknown, and a person decides.
- **What stays the application's**: which origins to list, the contact form's address (fixed in the
  environment, never the model's), the screenshot's PII decision (`files: PiiFileAction.AllowOriginal`:
  the original goes to the model; use `FileView.Transcription` for a masked text instead), and the file
  store of the screenshots (`InMemoryA2AFileRepository` here; use `LocalDisk`/`S3` in production).
- **A browser that cannot start** (Chromium not installed) is an error result of the tool, not a
  hang; the next call tries again.
- **A live run** (optional, your key): `OPENROUTER_API_KEY=… npm run demo:live` — the same two ways
  with a cheap model (`openai/gpt-4.1-nano`) against the same local site, well under a cent. The model's
  wording and its choices vary between runs; the demo prints them and checks nothing live.
