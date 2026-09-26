import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createAppDeps, mcpServerStub, toolOf, workflowOf, type ToolContext } from "graphcompose";
import { JobScout } from "../src/job-scout.workflow.js";
import { SHORTLIST_DIR, SHORTLIST_FILE } from "../src/config/paths.js";
import { SaveShortlist } from "../src/mcp/save-shortlist.mcp.js";
import { ShortlistServer } from "../src/mcp/shortlist.server.js";

const ctx: ToolContext = {
  runId: "r",
  workflow: "job-scout",
  agent: "shortlist",
  signal: new AbortController().signal,
  reportCost: () => undefined,
};
const job = (n: number) => ({
  title: `Backend Engineer ${String(n)}`,
  company: "Fireblocks",
  location: "Tel Aviv",
  link: `https://example.com/${String(n)}`,
  fit: 80 + n,
});
const env = { OPENROUTER_API_KEY: "k", TERN_DB: ":memory:" };

describe("the shortlist: MCP tools with the server injected (#109)", () => {
  afterAll(async () => {
    await rm(SHORTLIST_DIR, { recursive: true, force: true });
  });

  it("AC4: save_shortlist knows the file and never adds a job twice — through the real server", async () => {
    expect(SHORTLIST_DIR).toContain("job-scout-tests");
    const deps = await createAppDeps(await workflowOf(JobScout), env);
    try {
      const first = await deps.tools("save_shortlist").invoke({ jobs: [job(1), job(2)] }, ctx);
      const second = await deps.tools("save_shortlist").invoke({ jobs: [job(2), job(3)] }, ctx);
      const read = await deps.tools("read_shortlist").invoke({}, ctx);
      const file = await readFile(SHORTLIST_FILE, "utf8");

      expect(first).toEqual({
        kind: "ok",
        value: { added: ["Backend Engineer 1", "Backend Engineer 2"], alreadyThere: [] },
      });
      expect(second).toEqual({
        kind: "ok",
        value: { added: ["Backend Engineer 3"], alreadyThere: ["Backend Engineer 2"] },
      });
      expect(file.split("\n").filter((line) => line.startsWith("- ["))).toEqual([
        "- [Backend Engineer 1 — Fireblocks, Tel Aviv](https://example.com/1) · fit 81%",
        "- [Backend Engineer 2 — Fireblocks, Tel Aviv](https://example.com/2) · fit 82%",
        "- [Backend Engineer 3 — Fireblocks, Tel Aviv](https://example.com/3) · fit 83%",
      ]);
      expect(read).toEqual({ kind: "ok", value: { content: file } });
      expect(deps.config.agents.shortlist?.tools).toEqual(["read_shortlist", "save_shortlist"]);
    } finally {
      await deps.close();
    }
  }, 30_000);

  it("AC4: tested alone with a stub server — a missing file is an empty shortlist", async () => {
    const written: string[] = [];
    const server = mcpServerStub(ShortlistServer, {
      read_text_file: () => Promise.reject(new Error("ENOENT: no such file")),
      write_file: ({ content }) => {
        written.push(content);
        return Promise.resolve({ content: "ok" });
      },
    });

    const saved = await toolOf(new SaveShortlist(server, "/tmp/shortlist.md")).invoke(
      { jobs: [job(1)] },
      ctx,
    );

    expect(saved).toEqual({
      kind: "ok",
      value: { added: ["Backend Engineer 1"], alreadyThere: [] },
    });
    expect(written).toEqual([
      "# Shortlist\n- [Backend Engineer 1 — Fireblocks, Tel Aviv](https://example.com/1) · fit 81%\n",
    ]);
  });

  it("only the save waits for the user's approval", async () => {
    const workflow = await workflowOf(JobScout);
    const deps = await createAppDeps(workflow, env);
    try {
      expect(workflow.needsApproval?.(deps.tools("save_shortlist"))).toBe(true);
      expect(workflow.needsApproval?.(deps.tools("read_shortlist"))).toBe(false);
      expect(workflow.needsApproval?.(deps.tools("greenhouse_jobs"))).toBe(false);
    } finally {
      await deps.close();
    }
  }, 30_000);

  it("the server may touch only the shortlist folder", async () => {
    const workflow = await workflowOf(JobScout);
    const deps = await createAppDeps(workflow, env);
    try {
      const write = workflow.serverTools?.find((tool) => tool.name === "shortlist__write_file");
      const outside = await write?.invoke(
        { path: join(SHORTLIST_DIR, "..", "escape.md"), content: "x" },
        ctx,
      );

      expect(outside?.kind).toBe("error");
    } finally {
      await deps.close();
    }
  }, 30_000);
});
