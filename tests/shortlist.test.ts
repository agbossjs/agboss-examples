import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createAppDeps, workflowOf, type ToolContext } from "graphcompose";
import { JobScout } from "../src/job-scout.workflow.js";
import { SHORTLIST_DIR, SHORTLIST_FILE } from "../src/config/paths.js";

const ctx: ToolContext = {
  runId: "r",
  workflow: "job-scout",
  agent: "shortlist",
  signal: new AbortController().signal,
  reportCost: () => undefined,
};

describe("shortlist over the filesystem MCP server", () => {
  afterAll(async () => {
    await rm(SHORTLIST_DIR, { recursive: true, force: true });
  });

  it("AC1: the shortlist agent reads and writes the file through the real server (a temp folder in tests)", async () => {
    expect(SHORTLIST_DIR).toContain("job-scout-tests");
    const deps = await createAppDeps(await workflowOf(JobScout), {
      OPENROUTER_API_KEY: "k",
      TERN_DB: ":memory:",
    });
    try {
      const line = "- [Backend Engineer — Fireblocks, Tel Aviv](https://example.com/1) · fit 82%\n";
      const written = await deps
        .tools("shortlist__write_file")
        .invoke({ path: SHORTLIST_FILE, content: line }, ctx);
      const read = await deps
        .tools("shortlist__read_text_file")
        .invoke({ path: SHORTLIST_FILE }, ctx);

      expect(written.kind).toBe("ok");
      expect(await readFile(SHORTLIST_FILE, "utf8")).toBe(line);
      expect(JSON.stringify(read)).toContain("Fireblocks");
      expect(deps.config.agents.shortlist?.tools).toEqual([
        "shortlist__read_text_file",
        "shortlist__write_file",
      ]);
    } finally {
      await deps.close();
    }
  }, 30_000);

  it("AC2: only the write waits for the user's approval", async () => {
    const workflow = await workflowOf(JobScout);
    const deps = await createAppDeps(workflow, { OPENROUTER_API_KEY: "k", TERN_DB: ":memory:" });
    try {
      expect(workflow.needsApproval?.(deps.tools("shortlist__write_file"))).toBe(true);
      expect(workflow.needsApproval?.(deps.tools("shortlist__read_text_file"))).toBe(false);
      expect(workflow.needsApproval?.(deps.tools("greenhouse_jobs"))).toBe(false);
      expect(deps.pause).toBeDefined();
    } finally {
      await deps.close();
    }
  }, 30_000);

  it("the server may touch only the shortlist folder", async () => {
    const deps = await createAppDeps(await workflowOf(JobScout), {
      OPENROUTER_API_KEY: "k",
      TERN_DB: ":memory:",
    });
    try {
      const outside = await deps
        .tools("shortlist__write_file")
        .invoke({ path: join(SHORTLIST_DIR, "..", "escape.md"), content: "x" }, ctx);

      expect(outside.kind).toBe("error");
    } finally {
      await deps.close();
    }
  }, 30_000);
});
