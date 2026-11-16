import { afterEach, describe, expect, it } from "vitest";
import { claudeCliModelProvider } from "../../src/cli-providers/claude-cli.provider.js";
import { CliSetupError } from "../../src/cli-providers/errors.js";
import { fakeCli, MemoryLogger, RealClock, request } from "./harness.js";

// claude/live-*.jsonl were RECORDED from a real `claude -p` run (v2.1.325, the provider's own flags,
// agbossjs/agboss#963) and scrubbed by scripts/scrub-fixture.ts: see claude/README.md.
afterEach(() => {
  delete process.env.AGBOSS_CLAUDE_BINARY;
});

const claude = (): InstanceType<ReturnType<typeof claudeCliModelProvider>> =>
  new (claudeCliModelProvider({ acknowledgeVendorTermsRisk: true }))(new MemoryLogger(), new RealClock());

describe("Claude CLI provider on recorded live runs", () => {
  it("a plain answer: init lists only StructuredOutput, the reply is the structured output", async () => {
    process.env.AGBOSS_CLAUDE_BINARY = fakeCli(["claude/live-text.jsonl"]).binary;
    const response = await claude().complete(request({ tools: [] }));
    expect(response.text).toBe("ok");
    expect(response.usage).toEqual({ inputTokens: 2_814, cacheReadTokens: 984, cacheWriteTokens: 1_824, outputTokens: 276 });
  });

  it("a tool-call turn", async () => {
    process.env.AGBOSS_CLAUDE_BINARY = fakeCli(["claude/live-tool-call.jsonl"]).binary;
    const response = await claude().complete(request());
    expect(response.toolCalls?.[0]).toMatchObject({ name: "calculate-quote", arguments: { seats: 12, tier: "pro" } });
  });

  it("an unknown model is a setup error naming the model, not a retryable server error", async () => {
    process.env.AGBOSS_CLAUDE_BINARY = fakeCli(["claude/live-error.jsonl"]).binary;
    const failure = await claude().complete(request()).then(() => undefined, (error: unknown) => error);
    expect(failure).toBeInstanceOf(CliSetupError);
    expect((failure as Error).message).toMatch(/no-such-model-963/u);
  });
});
