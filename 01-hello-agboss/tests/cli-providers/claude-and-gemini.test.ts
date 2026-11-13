import { afterEach, describe, expect, it } from "vitest";
import { claudeCliModelProvider } from "../../src/cli-providers/claude-cli.provider.js";
import { CliNativeToolError } from "../../src/cli-providers/errors.js";
import { geminiCliModelProvider } from "../../src/cli-providers/gemini-cli.provider.js";
import { fakeCli, MemoryLogger, RealClock, request } from "./harness.js";

// The Claude and Gemini fixtures are written from the vendors' documentation, not recorded (no live run).
afterEach(() => {
  delete process.env.AGBOSS_CLAUDE_BINARY;
  delete process.env.AGBOSS_GEMINI_BINARY;
});

const claude = (): InstanceType<ReturnType<typeof claudeCliModelProvider>> =>
  new (claudeCliModelProvider({ acknowledgeVendorTermsRisk: true }))(new MemoryLogger(), new RealClock());
const gemini = (): InstanceType<ReturnType<typeof geminiCliModelProvider>> =>
  new (geminiCliModelProvider({ acknowledgeVendorTermsRisk: true }))(new MemoryLogger(), new RealClock());

describe("Claude CLI provider", () => {
  it("returns the structured output as tool calls, with its tools, MCP and hooks off", async () => {
    const cli = fakeCli(["claude/tool-call.jsonl"]);
    process.env.AGBOSS_CLAUDE_BINARY = cli.binary;
    const response = await claude().complete(request({ model: "claude-cli/sonnet" }));
    expect(response.toolCalls?.[0]).toMatchObject({ name: "calculate-quote", arguments: { seats: 12, tier: "pro" } });
    expect(response.usage).toEqual({ inputTokens: 3320, cacheReadTokens: 3000, cacheWriteTokens: 200, outputTokens: 40 });
    const call = cli.calls()[0];
    expect(call?.args).toEqual(expect.arrayContaining(["-p", "--safe-mode", "--strict-mcp-config", "--no-session-persistence", "--json-schema", "--system-prompt", "--model", "sonnet"]));
    expect(call?.args).not.toContain("--bare"); // bare mode never reads the subscription login
    expect(call?.args[call.args.indexOf("--tools") + 1]).toBe("");
    expect(call?.stdin).toContain("<conversation>");
  });

  it("kills the run on any tool of the CLI's own", async () => {
    process.env.AGBOSS_CLAUDE_BINARY = fakeCli(["claude/native-tool.jsonl"]).binary;
    await expect(claude().complete(request())).rejects.toBeInstanceOf(CliNativeToolError);
  });
});

describe("Gemini CLI provider", () => {
  it("parses the fenced JSON reply; its settings and deny-all policy sit in the temp directory", async () => {
    const cli = fakeCli(["gemini/tool-call.jsonl"]);
    process.env.AGBOSS_GEMINI_BINARY = cli.binary;
    const response = await gemini().complete(request());
    expect(response.toolCalls?.[0]).toMatchObject({ name: "calculate-quote", arguments: { seats: 12, tier: "pro" } });
    expect(response.usage).toEqual({ inputTokens: 250, outputTokens: 50 });
    const call = cli.calls()[0];
    expect(call?.files.sort()).toEqual([".gemini", "policy"]);
    expect(call?.args).toEqual(expect.arrayContaining(["--skip-trust", "--admin-policy", "--allowed-mcp-server-names", "__none__"]));
    expect(call?.stdin).toContain("<schema>"); // no schema flag: the schema is in the prompt
  });

  it("re-runs once when the reply is not JSON, and sums the tokens of both runs", async () => {
    const cli = fakeCli(["gemini/not-json.jsonl", "gemini/tool-call.jsonl"]);
    process.env.AGBOSS_GEMINI_BINARY = cli.binary;
    const response = await gemini().complete(request());
    expect(response.toolCalls).toHaveLength(1);
    expect(response.usage).toEqual({ inputTokens: 258, outputTokens: 52 });
    expect(cli.calls()[1]?.stdin).toContain("<agboss-correction>");
  });

  it("fails after a second bad reply, not a third run", async () => {
    const cli = fakeCli(["gemini/not-json.jsonl"]);
    process.env.AGBOSS_GEMINI_BINARY = cli.binary;
    await expect(gemini().complete(request())).rejects.toThrow(/cli\.invalid-output/u);
    expect(cli.calls()).toHaveLength(2);
  });

  it("kills the run on a tool event", async () => {
    process.env.AGBOSS_GEMINI_BINARY = fakeCli(["gemini/native-tool.jsonl"]).binary;
    await expect(gemini().complete(request())).rejects.toBeInstanceOf(CliNativeToolError);
  });

  it("kills the run on an event type it does not know (an allowlist, as for Codex)", async () => {
    process.env.AGBOSS_GEMINI_BINARY = fakeCli(["gemini/unknown-event.jsonl"]).binary;
    await expect(gemini().complete(request())).rejects.toBeInstanceOf(CliNativeToolError);
  });
});

describe("Claude: the structured-output tool in init is tolerated, and only it", () => {
  it("answers when init lists exactly StructuredOutput", async () => {
    process.env.AGBOSS_CLAUDE_BINARY = fakeCli(["claude/init-structured.jsonl"]).binary;
    expect((await claude().complete(request())).text).toBe("x");
  });
});
