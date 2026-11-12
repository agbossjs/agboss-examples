import { existsSync } from "node:fs";
import { ModelFailure, ModelProviderFailureError, ModelProviderMessageRole } from "@agboss/core/models";
import { usd } from "@agboss/core/units";
import { afterEach, describe, expect, it } from "vitest";
import { CodexCliModelProvider } from "../../src/cli-providers/codex-cli.provider.js";
import { CliNativeToolError } from "../../src/cli-providers/errors.js";
import { fakeCli, MemoryLogger, QUOTE_TOOL, RealClock, request } from "./harness.js";

afterEach(() => {
  delete process.env.AGBOSS_CODEX_BINARY;
});

function provider(): CodexCliModelProvider {
  return new CodexCliModelProvider(new MemoryLogger(), new RealClock());
}

describe("Codex CLI provider: a tool-call round trip over recorded JSONL", () => {
  it("turns the CLI's union reply into a tool call, and the tool result back into text", async () => {
    const cli = fakeCli(["codex/tool-call.jsonl", "codex/text.jsonl"]);
    process.env.AGBOSS_CODEX_BINARY = cli.binary;

    const first = await provider().complete(request());
    expect(first.toolCalls).toEqual([
      { id: expect.stringMatching(/^call_[0-9a-f]{8}_0$/u) as string, name: "calculate-quote", arguments: { seats: 12, tier: "pro" } },
    ]);
    expect(first.usage).toEqual({ inputTokens: 9427, cacheReadTokens: 0, outputTokens: 41 });
    expect(first.cost).toBe(usd(0));

    const id = first.toolCalls?.[0]?.id ?? "";
    const second = await provider().complete(
      request({
        messages: [
          ...request().messages,
          { role: ModelProviderMessageRole.Assistant, text: "", toolCalls: first.toolCalls ?? [] },
          { role: ModelProviderMessageRole.Tool, text: '{"monthly":805.8}', toolCallId: id },
        ],
      }),
    );
    expect(second.text).toBe("Hello from the fixture");

    const [one, two] = cli.calls().filter((call) => call.stdin !== "");
    // the history is serialised into the prompt, text escaped; the CLI's own tools are off
    expect(one?.stdin).toContain("A quote for 12 seats &amp; the pro tier?");
    expect(one?.stdin).toContain('<tool name="calculate-quote">');
    expect(two?.stdin).toContain(`<assistant-tool-call id="${id}" name="calculate-quote">`);
    expect(two?.stdin).toContain(`<tool-result id="${id}">{"monthly":805.8}</tool-result>`);
    expect(one?.args).toEqual(expect.arrayContaining(["exec", "--ephemeral", "--ignore-user-config", "--sandbox", "read-only"]));
    expect(one?.args).toContain("shell_tool");
    expect(one?.args).not.toContain("some_new_feature"); // only features the CLI lists
    expect(JSON.parse(one?.schema ?? "{}")).toMatchObject({ required: ["kind", "text", "calls"] });
    // a fresh, empty working directory (only the schema the call wrote), gone afterwards
    expect(one?.files).toEqual(["schema.json"]);
    expect(existsSync(one?.cwd ?? "")).toBe(false);
  });

  it("kills the run and fails the call when the CLI starts a tool of its own", async () => {
    const cli = fakeCli(["codex/native-tool.jsonl"]);
    process.env.AGBOSS_CODEX_BINARY = cli.binary;
    await expect(provider().complete(request())).rejects.toBeInstanceOf(CliNativeToolError);
  });

  it("maps a usage limit to a rate-limited failure the retry policy can see", async () => {
    process.env.AGBOSS_CODEX_BINARY = fakeCli([], "fail").binary;
    const error: unknown = await provider().complete(request()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ModelProviderFailureError);
    expect((error as ModelProviderFailureError).failure).toBe(ModelFailure.RateLimited);
  });

  it("says what to install when the CLI is missing", async () => {
    process.env.AGBOSS_CODEX_BINARY = "/nonexistent/codex";
    await expect(provider().complete(request({ tools: [QUOTE_TOOL] }))).rejects.toThrow(/cli\.setup/u);
  });
});
