import { afterEach, describe, expect, it } from "vitest";
import { claudeCliModelProvider } from "../../src/cli-providers/claude-cli.provider.js";
import { CodexCliModelProvider } from "../../src/cli-providers/codex-cli.provider.js";
import { fakeCli, MemoryLogger, RealClock, request, type FakeCli } from "./harness.js";

afterEach(() => {
  delete process.env.AGBOSS_CODEX_BINARY;
  delete process.env.AGBOSS_CLAUDE_BINARY;
});

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const until = async (check: () => boolean, ms = 8000): Promise<void> => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise((resolve) => setTimeout(resolve, 25));
};

describe("a call is cancelled, or times out", () => {
  it("kills the CLI and its children, then lets the next call run", async () => {
    const hang: FakeCli = fakeCli([], "hang");
    process.env.AGBOSS_CODEX_BINARY = hang.binary;
    const provider = new CodexCliModelProvider(new MemoryLogger(), new RealClock());
    const abort = new AbortController();
    const running = provider.complete(request({ signal: abort.signal }));
    const settled = running.then(() => "done", (error: unknown) => error);

    await until(() => hang.calls().some((call) => call.grandchild !== undefined));
    const { pid, grandchild } = hang.calls().find((call) => call.grandchild !== undefined) ?? {};
    expect(pid && grandchild).toBeTruthy();
    abort.abort(new Error("cancelled by the test"));

    expect(await settled).toMatchObject({ message: "cancelled by the test" });
    await until(() => !alive(grandchild ?? 0) && !alive(pid ?? 0));
    expect(alive(pid ?? 0)).toBe(false);
    expect(alive(grandchild ?? 0)).toBe(false); // the whole tree, not only the CLI

    // the lock was released only after the process was gone: the next call is not blocked
    process.env.AGBOSS_CODEX_BINARY = fakeCli(["codex/text.jsonl"]).binary;
    expect((await provider.complete(request())).text).toBe("Hello from the fixture");
  });

  it("kills the CLI when the attempt times out (the signal the framework passes)", async () => {
    const hang = fakeCli([], "hang");
    process.env.AGBOSS_CODEX_BINARY = hang.binary;
    const provider = new CodexCliModelProvider(new MemoryLogger(), new RealClock());
    const timedOut = await provider.complete(request({ signal: AbortSignal.timeout(2500) })).catch((e: unknown) => e);
    expect(timedOut).toBeInstanceOf(Error);
    const { pid, grandchild } = hang.calls()[0] ?? {};
    expect(pid && grandchild).toBeTruthy(); // it had started before the timeout
    await until(() => !alive(pid ?? 0) && !alive(grandchild ?? 0));
    expect(alive(pid ?? 0)).toBe(false);
    expect(alive(grandchild ?? 0)).toBe(false);
  });
});

describe("one CLI process at a time", () => {
  it("runs concurrent calls one after the other, across vendors", async () => {
    const codex = fakeCli(["codex/text.jsonl"], "slow");
    const claude = fakeCli(["claude/tool-call.jsonl"], "slow");
    process.env.AGBOSS_CODEX_BINARY = codex.binary;
    process.env.AGBOSS_CLAUDE_BINARY = claude.binary;
    const Claude = claudeCliModelProvider({ acknowledgeVendorTermsRisk: true });
    const a = new CodexCliModelProvider(new MemoryLogger(), new RealClock());
    const b = new Claude(new MemoryLogger(), new RealClock());

    await Promise.all([a.complete(request()), b.complete(request()), a.complete(request())]);

    const starts = [...codex.calls(), ...claude.calls()]
      .filter((call) => call.startedAt !== undefined)
      .map((call) => call.startedAt ?? 0)
      .sort((x, y) => x - y);
    expect(starts).toHaveLength(3);
    // each run sleeps 400 ms: a start is never within 350 ms of the one before
    const [first = 0, second = 0, third = 0] = starts;
    expect(second - first).toBeGreaterThanOrEqual(350);
    expect(third - second).toBeGreaterThanOrEqual(350);
  });
});
