import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { callTool, replyWith, routeTo, testWith } from "@agboss/core/testing";
import { JobScoutApplication } from "../src/job-scout.application.js";
import { ScoutAgent } from "../src/agents/scout.agent.js";
import { MainRouter } from "../src/routers/main.router.js";
import { ChatWorkflowStart } from "../src/workflow-starts/chat.workflow-start.js";
import { NOTES_DIR } from "../src/config/paths.js";
import { CompanyNotes } from "../src/rag/company-notes.rag.js";

const test = testWith(JobScoutApplication);
const signal = new AbortController().signal;
// agbossjs/agboss#700: every retrieval and index names its tenant — the notes are the default tenant's
const tenantId = "default";

describe("company notes (knowledge base)", () => {
  it("AC3: finds the note about a company, with its file as the source", async () => {
    const notes = new CompanyNotes({
      folder: NOTES_DIR,
      sqlitePath: join(await mkdtemp(join(tmpdir(), "notes-")), "notes.sqlite"),
    });

    const retrieval = await notes.retrieve("Why is Fireblocks a fit for a backend engineer?", {
      topK: 3,
      signal,
      tenantId,
    });

    expect(retrieval.results[0]?.source).toBe("fireblocks.md");
    expect(retrieval.results.map((result) => result.source)).not.toContain("readme.md");
  });

  test("AC3: the scout searches the notes itself (tool mode, 3 passages); the notes are marked as samples", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(MainRouter).thenReturn(routeTo(ScoutAgent));
    mockLlm(ScoutAgent).thenReturn(
      callTool(CompanyNotes, { query: "Why is Fireblocks a fit for a backend engineer?" }),
      replyWith("done"),
    );
    const index = await new CompanyNotes({
      folder: NOTES_DIR,
      sqlitePath: join(await mkdtemp(join(tmpdir(), "notes-")), "n.sqlite"),
    }).index({ tenantId, signal });

    const result = await app.execute(ChatWorkflowStart, { text: "what do my notes say?" });

    // the scout has the search tool (a call of a tool it lacks would fail), reading at most 3 passages
    const [search] = result.toolCalls;
    const found = (search?.output as { results: readonly unknown[] }).results;
    expect(search?.step.component.name).toBe("search-company-notes-rag-tool");
    expect(found.length).toBeLessThanOrEqual(3);
    expect(index.documents).toBe(5);
  });
});
