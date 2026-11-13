import { spawn } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CodexCliModelProvider } from "../../src/cli-providers/codex-cli.provider.js";
import { fakeCli, MemoryLogger, RealClock, request } from "./harness.js";

afterEach(() => {
  delete process.env.AGBOSS_CODEX_BINARY;
});

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const until = async (check: () => boolean, ms = 15_000): Promise<void> => {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await wait(25);
};
const codex = (): CodexCliModelProvider => new CodexCliModelProvider(new MemoryLogger(), new RealClock());

describe("a hung `codex features list`", () => {
  it("is cut by an abort, takes nobody else down, and is never cached", async () => {
    const hung = fakeCli(["codex/text.jsonl"], "hang-features");
    process.env.AGBOSS_CODEX_BINARY = hung.binary;
    const abort = new AbortController();
    const running = codex().complete(request({ signal: abort.signal }));
    const settled = running.then(() => "DONE", (error: unknown) => (error as Error).message);
    await wait(600);
    abort.abort(new Error("cancelled"));
    expect(await Promise.race([settled, wait(4000).then(() => "STILL PENDING")])).toBe("cancelled");

    // the next call does not wait on a lock: another CLI answers at once
    const good = fakeCli(["codex/text.jsonl"]);
    process.env.AGBOSS_CODEX_BINARY = good.binary;
    const next = await Promise.race([codex().complete(request()), wait(8000).then(() => "BLOCKED")]);
    expect(next).toMatchObject({ text: "Hello from the fixture" });

    // the hung listing was not remembered: the same path, now healthy, works
    process.env.AGBOSS_CODEX_BINARY = hung.binary;
    copyFileSync(good.binary, hung.binary);
    expect(await codex().complete(request())).toMatchObject({ text: "Hello from the fixture" });
  });
});

describe("Ctrl+C on the demo", () => {
  it("leaves no CLI, no grandchild and no temp directory, even for a CLI that ignores SIGTERM", async () => {
    const root = mkdtempSync(join(tmpdir(), "sigint-"));
    const tmp = join(root, "tmp");
    const pids = join(root, "pids");
    const binary = join(root, "codex");
    writeFileSync(
      binary,
      `#!/bin/sh\ntrap '' TERM\nif [ "$1" = features ]; then printf 'shell_tool stable true\\nunified_exec stable true\\n'; exit 0; fi\n` +
        `echo $$ > "${pids}"; sleep 600 & echo $! >> "${pids}"; wait\n`,
    );
    chmodSync(binary, 0o755);
    rmSync(tmp, { recursive: true, force: true });
    const { mkdirSync } = await import("node:fs");
    mkdirSync(tmp);

    const demo = spawn(process.execPath, ["--import", "tsx", "src/demo.cli.ts", "codex"], {
      cwd: join(import.meta.dirname, "..", ".."),
      env: { ...process.env, AGBOSS_CODEX_BINARY: binary, TMPDIR: tmp },
      stdio: "ignore",
    });
    const exited = new Promise<string>((resolve) => demo.once("exit", (code, signal) => { resolve(`${String(code)}/${String(signal)}`); }));
    await until(() => existsSync(pids) && readFileSync(pids, "utf8").trim().split("\n").length === 2);
    const [cli = 0, grandchild = 0] = readFileSync(pids, "utf8").trim().split("\n").map(Number);
    expect(alive(cli) && alive(grandchild)).toBe(true);
    expect(readdirSync(tmp).some((name) => name.startsWith("agboss-cli-"))).toBe(true);

    demo.kill("SIGINT");
    expect(await Promise.race([exited, wait(20_000).then(() => "STILL RUNNING")])).not.toBe("STILL RUNNING");
    await until(() => !alive(cli) && !alive(grandchild), 5000);
    expect(alive(cli)).toBe(false);
    expect(alive(grandchild)).toBe(false);
    expect(readdirSync(tmp).filter((name) => name.startsWith("agboss-cli-"))).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  }, 60_000);
});
