import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect } from "vitest";
import { provide } from "@agboss/core";
import { callTool, replyWith, routeTo, testWith } from "@agboss/core/testing";
import { JobScoutApplication } from "../src/job-scout.application.js";
import { ScoutAgent } from "../src/agents/scout.agent.js";
import { MainRouter } from "../src/routers/main.router.js";
import { ChatWorkflowStart } from "../src/workflow-starts/chat.workflow-start.js";
import { NOTES_DIR } from "../src/config/paths.js";
import { NOTES_INDEX } from "../src/rag/company-notes.rag.js";
import { SearchCompanyNotes } from "../src/tools/search-company-notes.tool.js";

// the index file lives in a temp folder, never in ~/.langgraph-agents; the first retrieval of the
// tenant builds it whole from the notes (a source is created by the application, so the tests go
// through its tool and its agent, not through a hand-made instance)
const test = testWith(JobScoutApplication, {
  services: [
    provide(NOTES_INDEX, {
      directory: NOTES_DIR,
      path: join(mkdtempSync(join(tmpdir(), "notes-")), "notes.sqlite"),
    }),
  ],
});

describe("company notes (knowledge base)", () => {
  test("AC3: finds the note about a company, with its file as the source", async ({ app }) => {
    const { output } = await app.runTool(SearchCompanyNotes, {
      query: "Why is Fireblocks a fit for a backend engineer?",
    });

    if (output.kind !== "ok") throw new Error(`the search failed: ${output.message}`);
    expect(output.value.results[0]?.source).toBe("fireblocks.md");
    expect(output.value.results.map((result) => result.source)).not.toContain("readme.md");
  });

  test("AC3: the scout searches the notes itself (tool mode, 3 passages); the notes are marked as samples", async ({
    app,
    mockModel,
  }) => {
    mockModel(MainRouter).thenReturn(routeTo(ScoutAgent));
    mockModel(ScoutAgent).thenReturn(
      callTool(SearchCompanyNotes, { query: "Why is Fireblocks a fit for a backend engineer?" }),
      replyWith("done"),
    );

    const result = await app.execute(ChatWorkflowStart, { text: "what do my notes say?" });

    // the scout has the search tool (a call of a tool it lacks would fail), reading at most 3 passages
    const [search] = result.toolCalls;
    const found = (search?.output as { results: readonly { source: string }[] }).results;
    expect(search?.step.component.name).toBe("search-company-notes-rag-tool");
    expect(found.length).toBeLessThanOrEqual(3);
    expect(found[0]?.source).toBe("fireblocks.md");
  });
});
