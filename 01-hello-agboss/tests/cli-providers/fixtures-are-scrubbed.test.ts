import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findLeaks, scrubLines } from "../../scripts/scrub-fixture.js";

const ROOT = join(import.meta.dirname, "fixtures");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });

describe("committed CLI fixtures hold no identity", () => {
  it("has fixtures to check", () => {
    expect(files(ROOT).length).toBeGreaterThan(10);
  });

  it.each(files(ROOT).map((path) => [path.slice(ROOT.length + 1), path] as const))(
    "%s: no email, home path, user temp path, token, vendor id or real UUID / session id",
    (_name, path) => {
      expect(findLeaks(readFileSync(path, "utf8"))).toEqual([]);
    },
  );
});

describe("the scrubber and its leak finder", () => {
  const leaky = [
    ["an email", '{"account":"someone@corp.example"}'],
    ["a macOS home path", '{"path":"/Users/someone/.claude/x"}'],
    ["a Linux home path", '{"path":"/home/someone/x"}'],
    ["a real session id", '{"session_id":"04327c69-ac8e-4a08-a3db-1504c6a630fe"}'],
    ["a per-user temp path", '{"cwd":"/private/var/folders/62/abc/T/x"}'],
    ["a vendor request id", '{"request_id":"req_011Ch6LqQ3xt7gHg7hnc9U5L"}'],
    ["a bearer token", '{"h":"Bearer abcdefghijklmnopqrstuvwxyz012345"}'],
  ] as const;

  it.each(leaky)("finds %s", (_name, text) => {
    expect(findLeaks(text)).not.toEqual([]);
  });

  it.each(leaky)("scrubs %s out of a recording", (_name, text) => {
    expect(findLeaks(scrubLines(`${text}\n`))).toEqual([]);
  });

  it("keeps one placeholder per real id, so a session stays one session", () => {
    const id = "04327c69-ac8e-4a08-a3db-1504c6a630fe";
    const out = scrubLines(`{"session_id":"${id}"}\n{"session_id":"${id}","x":"a@b.co"}\n`);
    const [a, b] = out.trim().split("\n").map((line) => JSON.parse(line) as Record<string, string>);
    expect(a?.["session_id"]).toBe(b?.["session_id"]);
    expect(a?.["session_id"]).toMatch(/^00000000-0000-4000-8000-\d{12}$/u);
    expect(b?.["x"]).toBe("user@example.com");
  });

  it("refuses a line that is not JSON, and writes nothing", () => {
    expect(() => scrubLines("not json\n")).toThrow();
  });
});
