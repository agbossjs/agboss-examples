import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { callTool, mcpServerStub, replyWith, routeTo, testWith, toolOf, workflowOf } from "@agboss/core/testing";
import { JobScout } from "../src/job-scout.workflow.js";
import { JobScoutApplication } from "../src/job-scout.application.js";
import { SHORTLIST_DIR, SHORTLIST_FILE } from "../src/config/paths.js";
import { ShortlistAgent } from "../src/agents/shortlist.agent.js";
import { MainRouter } from "../src/routers/main.router.js";
import { ReadShortlist } from "../src/mcp/read-shortlist.mcp.js";
import { SaveShortlist } from "../src/mcp/save-shortlist.mcp.js";
import { ShortlistServer } from "../src/mcp/shortlist.server.js";
import { ChatWorkflowStart } from "../src/workflow-starts/chat.workflow-start.js";
import { ChatWorkflowFinish } from "../src/workflow-finishes/chat.workflow-finish.js";

const job = (n: number) => ({
  title: `Backend Engineer ${String(n)}`,
  company: "Fireblocks",
  location: "Tel Aviv",
  link: `https://example.com/${String(n)}`,
  fit: 80 + n,
});

// the real filesystem MCP server behind the shortlist tools (agbossjs/agboss#834: through testWith,
// not the framework's internal createAppDeps)
const real = testWith(JobScoutApplication, { real: [ShortlistServer] });
const scripted = testWith(JobScoutApplication);

describe("the shortlist: MCP tools with the server injected (#109)", () => {
  // the file only: the folder (a temp one in tests) may be the one tests/demo.test.ts's app serves
  afterAll(async () => {
    await rm(SHORTLIST_FILE, { force: true });
  });

  real(
    "AC4: save-shortlist-tool knows the file and never adds a job twice — through the real server",
    async ({ app }) => {
      expect(SHORTLIST_DIR).toContain("job-scout-tests");
      const first = await app.tool(SaveShortlist).invoke({ jobs: [job(1), job(2)] });
      const second = await app.tool(SaveShortlist).invoke({ jobs: [job(2), job(3)] });
      const read = await app.tool(ReadShortlist).invoke({});
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
      expect((await workflowOf(JobScout)).config.agents["shortlist-agent"]?.tools).toEqual([
        "read-shortlist-tool",
        "save-shortlist-tool",
      ]);
    },
    30_000,
  );

  it("AC4: tested alone with a stub server — a missing file is an empty shortlist", async () => {
    const written: string[] = [];
    const server = mcpServerStub(ShortlistServer, {
      read_text_file: () => Promise.reject(new Error("ENOENT: no such file")),
      write_file: ({ content }) => {
        written.push(content);
        return Promise.resolve({ content: "ok" });
      },
    });

    const saved = await toolOf(new SaveShortlist(server, "/tmp/shortlist.md")).invoke({
      jobs: [job(1)],
    });

    expect(saved).toEqual({
      kind: "ok",
      value: { added: ["Backend Engineer 1"], alreadyThere: [] },
    });
    expect(written).toEqual([
      "# Shortlist\n- [Backend Engineer 1 — Fireblocks, Tel Aviv](https://example.com/1) · fit 81%\n",
    ]);
  });

  scripted(
    "only the save waits for the user's approval: reading the shortlist goes on at once",
    async ({ app, mockLlm, mcpOf }) => {
      mockLlm(MainRouter).thenReturn(routeTo(ShortlistAgent));
      mockLlm(ShortlistAgent).thenReturn(callTool(ReadShortlist, {}), replyWith("It is empty."));
      mcpOf(ShortlistServer).thenReturn({
        read_text_file: () => Promise.reject(new Error("ENOENT: no such file")),
      });

      const result = await app.execute(ChatWorkflowStart, { text: "what is on my shortlist?" });

      // the save's pause: tests/flow.test.ts (AC12)
      expect(result.pending).toEqual([]);
      expect(result).toFinishWith(ChatWorkflowFinish, { text: "It is empty." });
    },
  );

  real("the server may touch only the shortlist folder", async ({ app }) => {
    await app.ready();
    const outside = app
      .resolve(ShortlistServer)
      .call("write_file", { path: join(SHORTLIST_DIR, "..", "escape.md"), content: "x" });

    await expect(outside).rejects.toThrow();
  }, 30_000);
});
