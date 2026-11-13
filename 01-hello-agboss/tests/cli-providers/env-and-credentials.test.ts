import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { childEnv } from "../../src/cli-providers/child-env.js";
import { CodexCliModelProvider } from "../../src/cli-providers/codex-cli.provider.js";
import { fakeCli, MemoryLogger, RealClock, request } from "./harness.js";

const SECRETS = {
  OPENAI_API_KEY: "sk-openai",
  CODEX_API_KEY: "sk-codex",
  ANTHROPIC_API_KEY: "sk-anthropic",
  ANTHROPIC_AUTH_TOKEN: "t1",
  CLAUDE_CODE_OAUTH_TOKEN: "t2",
  GEMINI_API_KEY: "g1",
  GOOGLE_API_KEY: "g2",
  GOOGLE_APPLICATION_CREDENTIALS: "/x/creds.json",
  OPENROUTER_API_KEY: "sk-or",
  PII_PSEUDONYM_KEY: "pii",
};

afterEach(() => {
  for (const key of Object.keys(SECRETS)) Reflect.deleteProperty(process.env, key);
  delete process.env.AGBOSS_CODEX_BINARY;
});

describe("the CLI's environment is an allowlist", () => {
  it("passes the basics and the CLI's config-directory name, never a key or a token", () => {
    const env = childEnv({ PATH: "/bin", HOME: "/h", LC_ALL: "C", CODEX_HOME: "/c", ...SECRETS, RANDOM_VAR: "x" }, ["CODEX_HOME"]);
    expect(env).toEqual({ PATH: "/bin", HOME: "/h", LC_ALL: "C", CODEX_HOME: "/c" });
  });

  it("holds for a real run: no key of ours reaches the child process", async () => {
    Object.assign(process.env, SECRETS);
    const cli = fakeCli(["codex/text.jsonl"]);
    process.env.AGBOSS_CODEX_BINARY = cli.binary;
    await new CodexCliModelProvider(new MemoryLogger(), new RealClock()).complete(request());
    const seen = cli.calls().find((call) => call.stdin !== "")?.env ?? [];
    expect(seen).toContain("PATH");
    for (const key of Object.keys(SECRETS)) expect(seen).not.toContain(key);
  });
});

describe("the red line: the vendors' credential files are never touched", () => {
  const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "cli-providers");
  const FORBIDDEN = [/\.codex/u, /\.claude/u, /auth\.json/u, /\.credentials/u, /oauth_creds/u, /google_accounts/u, /keychain/iu, /keytar/u, /find-generic-password/u];

  it("has no credential path in the source", () => {
    for (const file of readdirSync(SRC)) {
      const text = readFileSync(join(SRC, file), "utf8").replace(/^\s*\/\/.*$/gmu, "").replace(/https?:\/\/\S+/gu, "");
      for (const pattern of FORBIDDEN) expect(text, `${file} ${String(pattern)}`).not.toMatch(pattern);
      // `.gemini` only as the project settings directory inside our own temp directory
      if (file !== "gemini-cli.provider.ts") expect(text, file).not.toMatch(/\.gemini/u);
    }
    expect(readFileSync(join(SRC, "gemini-cli.provider.ts"), "utf8")).toMatch(/join\(dir, "\.gemini"/u);
  });
});
