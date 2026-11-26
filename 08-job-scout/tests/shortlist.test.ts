import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, describe, expect } from "vitest";
import { callTool, replyWith, routeTo, testWith } from "@agboss/core/testing";
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
      const first = (await app.runTool(SaveShortlist, { jobs: [job(1), job(2)] })).output;
      const second = (await app.runTool(SaveShortlist, { jobs: [job(2), job(3)] })).output;
      const read = (await app.runTool(ReadShortlist, {})).output;
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
    },
    30_000,
  );

  scripted(
    "AC4: tested alone with a stub server — a folder without the file is an empty shortlist",
    async ({ app, mockMcp }) => {
      const written: string[] = [];
      mockMcp(ShortlistServer).thenReturn({
        list_directory: () => Promise.resolve({ content: "" }),
        write_file: ({ content }) => {
          written.push(content);
          return Promise.resolve({ content: "ok" });
        },
      });

      const saved = (await app.runTool(SaveShortlist, { jobs: [job(1)] })).output;

      expect(saved).toEqual({
        kind: "ok",
        value: { added: ["Backend Engineer 1"], alreadyThere: [] },
      });
      expect(written).toEqual([
        "# Shortlist\n- [Backend Engineer 1 — Fireblocks, Tel Aviv](https://example.com/1) · fit 81%\n",
      ]);
    },
  );

  scripted(
    "only the save waits for the user's approval: reading the shortlist goes on at once",
    async ({ app, mockModel, mockMcp }) => {
      mockModel(MainRouter).thenReturn(routeTo(ShortlistAgent));
      mockModel(ShortlistAgent).thenReturn(callTool(ReadShortlist, {}), replyWith("It is empty."));
      mockMcp(ShortlistServer).thenReturn({
        list_directory: () => Promise.resolve({ content: "" }),
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

describe("the shortlist before anything was saved", () => {
  real(
    "reading a folder without the file is an empty shortlist, through the real server",
    async ({ app }) => {
      await rm(SHORTLIST_FILE, { force: true });

      const read = (await app.runTool(ReadShortlist, {})).output;

      expect(read).toEqual({ kind: "ok", value: { content: "" } });
    },
    30_000,
  );
});
