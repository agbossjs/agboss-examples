// agbossjs/agboss#768: `npm run cluster:up` on a fresh clone. The image's `dist/` is compiled from
// `src/`, whose flow is typed by `.agboss/types.d.ts` — generated, git-ignored, absent from a fresh
// clone. The image build must write it before it compiles: a copy of the project without `.agboss/`
// compiles with the build's own step and nothing else.
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";

const PROJECT = join(import.meta.dirname, "..", "..");
const copies: string[] = [];

afterEach(() => {
  for (const copy of copies.splice(0)) rmSync(copy, { recursive: true, force: true });
});

/** The project as a fresh clone has it: its sources and scripts, its installed packages, no `.agboss/`. */
function freshCopy(): string {
  // by its real path: the script runs only when it is the module node was started with (macOS's
  // tmpdir is a symlink, /var → /private/var)
  const copy = realpathSync(mkdtempSync(join(tmpdir(), "agboss-768-")));
  copies.push(copy);
  for (const entry of ["src", "scripts", "package.json", "tsconfig.json", "tsconfig.build.json"])
    cpSync(join(PROJECT, entry), join(copy, entry), { recursive: true });
  symlinkSync(join(PROJECT, "node_modules"), join(copy, "node_modules"), "dir");
  return copy;
}

/** Runs a script to its end: its exit code and its output. */
function runScript(script: string, args: readonly string[], cwd: string) {
  return new Promise<{ code: number | null; output: string }>((resolve) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, env: process.env });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("close", (code) => {
      resolve({ code, output });
    });
  });
}

it("#768 AC1, AC2: the image build compiles dist/ on a fresh clone — it writes the flow's types first", async () => {
  const copy = freshCopy();
  expect(existsSync(join(copy, ".agboss", "types.d.ts"))).toBe(false);

  const build = await runScript(
    join(copy, "scripts", "cluster", "build-image.mjs"),
    ["--compile-only"],
    copy,
  );

  expect(build.output).not.toContain("MissingGeneratedTypes");
  expect(build.code, build.output).toBe(0);
  expect(build.output).toContain("ok: src/kubernetes-scaling.application.ts");
  expect(existsSync(join(copy, ".agboss", "types.d.ts"))).toBe(true);
  expect(existsSync(join(copy, "dist", "main.js"))).toBe(true);
}, 180_000);
