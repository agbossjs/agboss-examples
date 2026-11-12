import { copyFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { claudeCliModelProvider } from "../../src/cli-providers/claude-cli.provider.js";
import { CodexCliModelProvider } from "../../src/cli-providers/codex-cli.provider.js";
import { CliNativeToolError, CliSetupError } from "../../src/cli-providers/errors.js";
import { fakeCli, MemoryLogger, RealClock, request } from "./harness.js";

afterEach(() => {
  delete process.env.AGBOSS_CODEX_BINARY;
  delete process.env.AGBOSS_CLAUDE_BINARY;
});

const codex = (): CodexCliModelProvider => new CodexCliModelProvider(new MemoryLogger(), new RealClock());
const claude = (): InstanceType<ReturnType<typeof claudeCliModelProvider>> =>
  new (claudeCliModelProvider({ acknowledgeVendorTermsRisk: true }))(new MemoryLogger(), new RealClock());

describe("the tools-off setup fails closed", () => {
  it.each(["unknown-features", "broken-features"])(
    "Codex refuses to run when `features list` is unreadable (%s): the CLI is never started",
    async (mode) => {
      const cli = fakeCli(["codex/text.jsonl"], mode);
      process.env.AGBOSS_CODEX_BINARY = cli.binary;
      await expect(codex().complete(request())).rejects.toBeInstanceOf(CliSetupError);
      expect(cli.calls()).toEqual([]); // no `codex exec` ran
    },
  );

  it("Codex never caches a listing that failed the check", async () => {
    const bad = fakeCli(["codex/text.jsonl"], "unknown-features");
    process.env.AGBOSS_CODEX_BINARY = bad.binary;
    await expect(codex().complete(request())).rejects.toBeInstanceOf(CliSetupError);
    const good = fakeCli(["codex/text.jsonl"]);
    copyFileSync(good.binary, bad.binary); // the same path now lists its features properly
    expect((await codex().complete(request())).text).toBe("Hello from the fixture");
  });

  it("Claude gives no answer unless its init event confirms no tools, and kills on a listed tool", async () => {
    process.env.AGBOSS_CLAUDE_BINARY = fakeCli(["claude/no-init.jsonl"]).binary;
    await expect(claude().complete(request())).rejects.toThrow(/model\.provider-failure/u);
    process.env.AGBOSS_CLAUDE_BINARY = fakeCli(["claude/init-tools.jsonl"]).binary;
    await expect(claude().complete(request())).rejects.toBeInstanceOf(CliNativeToolError);
  });
});
