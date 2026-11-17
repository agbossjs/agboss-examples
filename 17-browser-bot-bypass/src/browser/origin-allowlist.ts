/**
 * The one network rule of a browser the model drives: it may request only the origins the
 * application lists. Everything else — 127.0.0.1, `localhost`, the cloud metadata address
 * 169.254.169.254, a LAN address, `file:` — is refused. The check is the context's route
 * (`guardContext`): every request of every page, by EXACT origin (scheme, host and port), and every hop
 * of a redirect, which the route follows by hand because the browser's own follow is not routed. The
 * browser's resolver rules (`resolverRulesOf`) are defence in depth behind it — only the listed
 * hostnames resolve — never the main check: they are by host name, not by origin. The same two guard
 * Way A (the tool's browser) and Way B (the MCP server's browser).
 *
 * The boundary: both check the name in the URL, not the address it resolves to. List origins you
 * trust to resolve to the public internet; a hostile DNS record on a listed name is not covered —
 * for that, put the browser behind an egress proxy or a network policy (README, "Guarantee boundary").
 * (Playwright's route is not called for a redirect's next hop: `16-browser-playwright` shows it, so the guard follows redirects by hand.)
 */

import type { PortContext } from "./browser-port.js";

/** What a refusal leaves behind, for the audit and the test. */
export type RefusedRequest = (url: string) => void;

/** What `BROWSER_ALLOWED_ORIGINS` says: the origins, and a test site's name → address rule. */
export interface Allowlist {
  readonly origins: readonly string[];
  /** Chromium's `MAP name address` rules, comma-separated; empty in a deployment. */
  readonly hostMap: string;
}

/**
 * The list of `BROWSER_ALLOWED_ORIGINS`: semicolon-separated, each `scheme://host[:port]`. An entry
 * may end in `=address` (`http://shop.test:8080=127.0.0.1`): a name with no DNS, mapped to an address
 * for the browser — how the tests and the demo reach their local site while 127.0.0.1 itself stays
 * refused. Never in a deployment. One variable carries both because the MCP server's child process
 * reads this one.
 */
export function parseAllowlist(value: string | undefined): Allowlist {
  const entries = (value ?? "")
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "")
    .map((entry) => {
      const [origin = "", address] = entry.split("=");
      const parsed = new URL(origin);
      return { origin: parsed.origin, rule: address === undefined ? undefined : `MAP ${parsed.hostname} ${address}` };
    });
  return {
    origins: entries.map((entry) => entry.origin),
    hostMap: entries.flatMap((entry) => (entry.rule === undefined ? [] : [entry.rule])).join(", "),
  };
}

/** Whether a request to `url` may leave the browser: an http(s) URL on a listed origin, nothing else. */
export function isAllowedUrl(url: string, allowedOrigins: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  return allowedOrigins.includes(parsed.origin);
}

/**
 * Chromium's `--host-resolver-rules`, DEFENCE IN DEPTH behind the route: only the listed hostnames resolve,
 * every other name and every IP literal fails with `ERR_NAME_NOT_RESOLVED`. By host name, not by origin
 * (another port of a listed host resolves); `hostMap` is a test site's name → address rule, first in the
 * list (Chromium checks EXCLUDE rules first and then maps nothing, so a mapped name is not excluded).
 */
export function resolverRulesOf(allowedOrigins: readonly string[], hostMap = ""): string {
  const mapped = new Set(
    hostMap
      .split(",")
      .map((rule) => /^\s*MAP\s+(\S+)\s+\S+\s*$/u.exec(rule)?.[1])
      .filter((name): name is string => name !== undefined),
  );
  const hosts = [...new Set(allowedOrigins.map((origin) => new URL(origin).hostname))].filter((host) => !mapped.has(host));
  return [...(hostMap === "" ? [] : [hostMap]), ...hosts.map((host) => `EXCLUDE ${host}`), "MAP * ~NOTFOUND"].join(", ");
}

/** How many redirect hops a request may take. */
const MAX_REDIRECTS = 10;

/**
 * Makes `context` request listed origins only, by exact origin (scheme, host and port), for EVERY
 * request of every page of the context — navigations, subresources, popups — and for every hop of a
 * redirect. A request the browser is allowed to follow by itself is not checked at its next hop:
 * Playwright's route is not called for it, `continue()` or `fulfill()` of a 302 alike (shown by
 * `tests/redirects.test.ts`). So no request is continued: it is fetched here with `maxRedirects: 0`,
 * each `Location` is checked against the list BEFORE it is requested, and the final answer is handed
 * to the browser as it is. The price: a redirected page is shown at the URL that was asked for. A meta
 * refresh and a script's `location = …` are new navigations: they meet this route again.
 *
 * `hostMap` (`MAP name address`, tests and demos) is applied to the server-side fetch the way the
 * browser applies it to its own: the request goes to the address with the name in `Host`.
 */
export async function guardContext(
  context: PortContext,
  allowedOrigins: readonly string[],
  onRefused: RefusedRequest = () => undefined,
  hostMap = "",
): Promise<void> {
  const addresses = new Map(
    [...hostMap.matchAll(/MAP\s+(\S+)\s+(\S+)/gu)].map((rule) => [rule[1] ?? "", rule[2] ?? ""] as const),
  );
  await context.route("**/*", async (route) => {
    try {
      await guardRoute(route);
    } catch {
      // the context closed while the request was in flight (a timeout, a cancelled run, app.close()), or the
      // site could not be fetched: fail closed — the request is dropped, and nothing here may throw
      // unhandled into the process
      await route.abort("failed").catch(() => undefined);
    }
  });

  async function guardRoute(route: Parameters<Parameters<typeof context.route>[1]>[0]): Promise<void> {
    const request = route.request();
    let url = request.url();
    for (let hop = 0; ; hop += 1) {
      if (!isAllowedUrl(url, allowedOrigins) || hop > MAX_REDIRECTS) {
        onRefused(url);
        await route.abort("blockedbyclient");
        return;
      }
      const target = new URL(url);
      const address = addresses.get(target.hostname);
      const response = await route.fetch({
        maxRedirects: 0,
        ...(address === undefined
          ? { url }
          : { url: Object.assign(new URL(url), { hostname: address }).href, headers: { ...request.headers(), host: target.host } }),
      });
      const location = response.headers().location;
      if (response.status() < 300 || response.status() >= 400 || location === undefined) {
        await route.fulfill({ response });
        return;
      }
      url = new URL(location, url).href; // checked at the top of the loop, before it is requested
    }
  }
}

/** The error a tool gives the model for a URL outside the list: it names the rule, not the list. */
export class OriginRefusedError extends Error {
  constructor(readonly url: string) {
    super(`refused: ${url} is not an allowed origin`);
    this.name = "OriginRefusedError";
  }
}
