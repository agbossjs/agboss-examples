/**
 * Scrubs a raw vendor-CLI recording before it can be committed (agbossjs/agboss#963), and says what a
 * scrubbed recording must never still hold. `scrubLines` is what the recorder calls; `findLeaks` is also
 * what the fixture test runs over every committed fixture, so a hand edit cannot put a leak back.
 */
import { hostname, userInfo } from "node:os";

/** Every real id becomes `00000000-0000-4000-8000-<n>`: the only UUID-like value a fixture may hold. */
export const PLACEHOLDER_UUID = /^00000000-0000-4000-8000-[0-9]{12}$/u;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/gu;
/** A user's home directory on macOS, Linux or Windows. */
const HOME_PATH = /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)[^/\\"\s]+/gu;
/** The per-user temp folders macOS and Linux give a process: the user's identity hides in them. */
const USER_TMP = /\/(?:private\/)?var\/folders\/[^"\s]+|\/tmp\/claude-[^"\s]+/gu;
/** Vendor request / message / tool-use ids: not secret, but account-correlatable, so they are replaced. */
const VENDOR_ID = /\b(?:msg|req|toolu|chatcmpl)_[A-Za-z0-9]{10,}/gu;
const BEARER = /\b(?:sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{30,}|ya29\.[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._-]{20,})/gu;

const PLACEHOLDER_EMAIL = "user@example.com";
const PLACEHOLDER_HOME = "/home/user";

const uuidFor = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** What is still in `text` that must not be committed (empty = clean). */
export function findLeaks(text: string, extra: readonly string[] = []): string[] {
  const leaks: string[] = [];
  for (const match of text.match(EMAIL) ?? []) if (match !== PLACEHOLDER_EMAIL) leaks.push(`email ${match}`);
  for (const match of text.match(HOME_PATH) ?? []) if (match !== PLACEHOLDER_HOME) leaks.push(`home path ${match}`);
  for (const match of text.match(USER_TMP) ?? []) leaks.push(`user temp path ${match}`);
  for (const match of text.match(UUID) ?? []) if (!PLACEHOLDER_UUID.test(match)) leaks.push(`uuid ${match}`);
  for (const match of text.match(VENDOR_ID) ?? []) if (!match.includes("PLACEHOLDER")) leaks.push(`vendor id ${match}`);
  for (const match of text.match(BEARER) ?? []) leaks.push(`token ${match.slice(0, 6)}...`);
  for (const word of extra) if (word.length >= 3 && text.toLowerCase().includes(word.toLowerCase())) leaks.push(`identity ${word}`);
  return leaks;
}

/** Keys whose value identifies the user or the account, or that is a signature / secret: replaced by key. */
const BY_KEY: Readonly<Record<string, unknown>> = {
  plugins: [],
  signature: "SIGNATURE",
  cwd: "/tmp/agboss-cli-PLACEHOLDER",
  original_cwd: "/tmp/agboss-cli-PLACEHOLDER",
  messaging_socket_path: "/tmp/cc-socks/PLACEHOLDER.sock",
  total_cost_usd: 0,
  costUSD: 0,
  credential_expires_at: "1970-01-01T00:00:00.000Z",
  timestamp: "1970-01-01T00:00:00.000Z",
  resetsAt: 0,
  overageResetsAt: 0,
  utilization: 0,
};

function walk(value: unknown, state: { n: number; seen: Map<string, string> }, identity: readonly string[]): unknown {
  if (typeof value === "string") {
    let text = value
      .replace(UUID, (id) => {
        const key = id.toLowerCase();
        if (!state.seen.has(key)) state.seen.set(key, uuidFor(++state.n));
        return state.seen.get(key) ?? key;
      })
      .replace(HOME_PATH, PLACEHOLDER_HOME)
      .replace(USER_TMP, "/tmp/PLACEHOLDER")
      .replace(EMAIL, PLACEHOLDER_EMAIL)
      .replace(BEARER, "TOKEN")
      .replace(VENDOR_ID, (id) => `${id.split("_")[0] ?? "id"}_PLACEHOLDER`);
    for (const word of identity) text = text.replaceAll(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "giu"), "user");
    return text;
  }
  if (Array.isArray(value)) return value.map((item) => walk(item, state, identity));
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      const safeKey = walk(key, state, identity) as string; // ids also appear as object keys
      out[safeKey] = key in BY_KEY ? BY_KEY[key] : walk(inner, state, identity);
    }
    return out;
  }
  return value;
}

/** The names of this machine and account, taken from the OS: scrubbed out of every string. */
const identityWords = (): string[] =>
  [userInfo().username, hostname().replace(/\.local$/u, "")].filter((word) => word.length >= 3);

/**
 * One JSON event per line in, the scrubbed lines out. Throws, writing nothing, when a line is not JSON or
 * something identifying survives (the caller never commits a raw recording).
 */
export function scrubLines(raw: string): string {
  const state = { n: 0, seen: new Map<string, string>() };
  const identity = identityWords();
  const lines = raw.split("\n").filter((line) => line.trim() !== "");
  const out = lines.map((line) => JSON.stringify(walk(JSON.parse(line), state, identity)));
  const text = `${out.join("\n")}\n`;
  const leaks = findLeaks(text, identity);
  if (leaks.length > 0) throw new Error(`scrubbing left ${String(leaks.length)} leak(s): ${leaks.slice(0, 5).join("; ")}`);
  return text;
}
