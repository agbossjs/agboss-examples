import { describe, expect } from "vitest";
import { callTool, replyWith, routeTo, testWith } from "@agboss/core/testing";
import { JobScoutApplication } from "../src/job-scout.application.js";
import { MainRouter } from "../src/routers/main.router.js";
import { ProfilerAgent } from "../src/agents/profiler.agent.js";
import { ScoutAgent } from "../src/agents/scout.agent.js";
import { ShortlistAgent } from "../src/agents/shortlist.agent.js";
import { SaveShortlist } from "../src/mcp/save-shortlist.mcp.js";
import { ShortlistServer } from "../src/mcp/shortlist.server.js";
import { ChatWorkflowStart } from "../src/workflow-starts/chat.workflow-start.js";
import { ChatWorkflowFinish } from "../src/workflow-finishes/chat.workflow-finish.js";

const test = testWith(JobScoutApplication);

describe("job-scout on the path grammar (#272)", () => {
  test("the main router sends to the profiler, whose answer finishes the turn", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(MainRouter).thenReturn(routeTo(ProfilerAgent));
    mockLlm(ProfilerAgent).thenReturn(replyWith("ok"));

    const result = await app.execute(ChatWorkflowStart, { text: "hello" });

    expect(result).toFollowPath([ChatWorkflowStart, MainRouter, ProfilerAgent, ChatWorkflowFinish]);
  });

  test("the main router sends to the scout, whose answer finishes the turn", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(MainRouter).thenReturn(routeTo(ScoutAgent));
    mockLlm(ScoutAgent).thenReturn(replyWith("ok"));

    const result = await app.execute(ChatWorkflowStart, { text: "hello" });

    expect(result).toFollowPath([ChatWorkflowStart, MainRouter, ScoutAgent, ChatWorkflowFinish]);
  });

  test("the main router sends to the shortlist agent, whose answer finishes the turn", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(MainRouter).thenReturn(routeTo(ShortlistAgent));
    mockLlm(ShortlistAgent).thenReturn(replyWith("ok"));

    const result = await app.execute(ChatWorkflowStart, { text: "hello" });

    expect(result).toFollowPath([ChatWorkflowStart, MainRouter, ShortlistAgent, ChatWorkflowFinish]);
  });

  test("the main router chooses among three routes, listed by name", async ({ app, mockLlm }) => {
    mockLlm(MainRouter).thenReturn(routeTo(ProfilerAgent));
    mockLlm(ProfilerAgent).thenReturn(replyWith("ok"));

    await app.execute(ChatWorkflowStart, { text: "hello" });

    expect(mockLlm(MainRouter).onlyRequest).toMatchObject({
      kind: "decision",
      options: ["profiler-agent", "scout-agent", "shortlist-agent"],
    });
  });
});

// guardrails, compaction and the router's model: the ledger of tests/demo.test.ts (2 input
// guardrails, the router, the scout's calls, the output guardrail), the config by `agboss check`

const job = {
  title: "Backend Engineer",
  company: "Fireblocks",
  location: "Tel Aviv",
  link: "https://example.com/1",
  fit: 81,
};

describe("job-scout by script (#135): a turn, the approval pause and resume", () => {
  test("AC12: the main router sends the message to the agent, whose answer finishes the turn", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(MainRouter).thenReturn(routeTo(ProfilerAgent));
    mockLlm(ProfilerAgent).thenReturn(replyWith("Brief: senior backend, Israel"));

    const result = await app.execute(ChatWorkflowStart, { text: "propose a search brief" });

    expect(result).toFollowPath([ChatWorkflowStart, MainRouter, ProfilerAgent, ChatWorkflowFinish]);
    expect(result).toFinishWith(ChatWorkflowFinish, { text: "Brief: senior backend, Israel" });
    expect(mockLlm(MainRouter)).toHaveBeenAskedWith({ input: "propose a search brief" });
  });

  test("AC12: saving to the shortlist waits for approval; after it the agent's answer finishes the turn", async ({
    app,
    mockLlm,
    mcpOf,
  }) => {
    mockLlm(MainRouter).thenReturn(routeTo(ShortlistAgent));
    mockLlm(ShortlistAgent).thenReturn(
      callTool(SaveShortlist, { jobs: [job] }),
      replyWith("Saved 1 job."),
    );
    const written: string[] = [];
    mcpOf(ShortlistServer).thenReturn({
      read_text_file: () => Promise.reject(new Error("ENOENT: no such file")),
      write_file: ({ content }: { content: string }) => {
        written.push(content);
        return Promise.resolve({ content: "ok" });
      },
    });

    const paused = await app.execute(ChatWorkflowStart, { text: "save the first job" });
    const pauseId = paused.pending[0]?.pauseId ?? "";
    const done = await app.resume({ pauseId, decision: { approved: true } });

    expect(paused).toHavePausedAt(ShortlistAgent);
    expect(done).toFinishWith(ChatWorkflowFinish, { text: "Saved 1 job." });
    expect(mockLlm(MainRouter).requests).toHaveLength(1);
    expect(mockLlm(ShortlistAgent)).toHaveScriptedToolCalls([SaveShortlist]);
    expect(written).toEqual([
      "# Shortlist\n- [Backend Engineer — Fireblocks, Tel Aviv](https://example.com/1) · fit 81%\n",
    ]);
  });

  test("AC12: a declined save is not written; the agent answers after the decision", async ({
    app,
    mockLlm,
    mcpOf,
  }) => {
    mockLlm(MainRouter).thenReturn(routeTo(ShortlistAgent));
    mockLlm(ShortlistAgent).thenReturn(
      callTool(SaveShortlist, { jobs: [job] }),
      replyWith("Not saved."),
    );
    const shortlist = mcpOf(ShortlistServer);

    const paused = await app.execute(ChatWorkflowStart, { text: "save the first job" });
    const pauseId = paused.pending[0]?.pauseId ?? "";
    const done = await app.resume({ pauseId, decision: { approved: false, reason: "no" } });

    expect(done).toFinishWith(ChatWorkflowFinish, { text: "Not saved." });
    expect(shortlist.calls).toEqual([]);
  });
});
