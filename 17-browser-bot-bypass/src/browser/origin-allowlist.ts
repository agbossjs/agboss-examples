/**
 * The one network rule of a browser the model drives: it may request only the origins the
 * application lists. Everything else — 127.0.0.1, `localhost`, the cloud metadata address
 * 169.254.169.254, a LAN address, `file:` — is refused, by two layers that each stop what the other
 * misses: a route on the context (`guardContext`: the first request of every page and every
 * subresource, by exact origin) and the browser's resolver rules (`resolverRulesOf`: a redirect's
 * next hop, an IP literal). The same two guard Way A (the tool's browser) and Way B (the MCP
 * server's browser). The browser has its own network, outside agboss's A2A SSRF guard: this is the
 * example's own.
 *
 * The boundary: both check the name in the URL, not the address it resolves to. List origins you
 * trust to resolve to the public internet; a hostile DNS record on a listed name is not covered —
 * for that, put the browser behind an egress proxy or a network policy (README, "Guarantee boundary").
 * (Playwright's `route` is not called for a redirect's next hop: `16-browser-playwright` shows it.)
 */

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
 * Chromium's `--host-resolver-rules` for the listed origins: only their hostnames resolve, every
 * other name — and every IP literal — fails with `ERR_NAME_NOT_RESOLVED`; a redirect's next hop too.
 * `hostMap` is a test site's name → address rule, first in the list (Chromium checks EXCLUDE rules
 * first and then maps nothing, so a mapped name is not excluded).
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

/** The error a tool gives the model for a URL outside the list: it names the rule, not the list. */
export class OriginRefusedError extends Error {
  constructor(readonly url: string) {
    super(`refused: ${url} is not an allowed origin`);
    this.name = "OriginRefusedError";
  }
}
