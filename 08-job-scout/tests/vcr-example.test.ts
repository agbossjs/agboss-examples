import { CassetteMissingError, testWith, VCRMode } from "@agboss/core/testing";
import { expect } from "vitest";
import { JobScoutApplication } from "../src/job-scout.application.js";
import { MainRouter } from "../src/routers/main.router.js";
import { ProfilerAgent } from "../src/agents/profiler.agent.js";
import { ChatWorkflowStart } from "../src/workflow-starts/chat.workflow-start.js";
import { ChatWorkflowFinish } from "../src/workflow-finishes/chat.workflow-finish.js";

/**
 * Replays tests/cassettes/job-scout-brief.cassette.json: every model call of the run (the guardrails,
 * the Jev main router, the profiler) answers from the cassette — no script, no key, no network.
 * Recorded from real models (version 2: each interaction keyed by its prompt and schema hashes, so
 * `agboss check --cassettes` names a stale one). Re-record after a prompt, tool or flow change:
 * `mode: VCRMode.RECORD` on `env: "dev"` with a model key and `allowNetwork: ["openrouter.ai"]`.
 */
const test = testWith(JobScoutApplication, {
  vcr: { cassetteName: "job-scout-brief", dir: "tests/cassettes", mode: VCRMode.REPLAY },
});

test("the recorded brief run replays through the real graph without a model", async ({ app }) => {
  const result = await app.execute(ChatWorkflowStart, { text: "propose a search brief" });

  expect(result).toFollowPath([ChatWorkflowStart, MainRouter, ProfilerAgent, ChatWorkflowFinish]);
  expect(result).toFinishWith(ChatWorkflowFinish, {
    // what the profiler (moonshotai/kimi-k2.6) answered when the cassette was recorded: no resume given
    text: "Please provide the path to your resume (.pdf, .md, or .txt) so I can prepare your search brief.",
  });
});

test("a message the cassette did not record fails loudly instead of calling a model", async ({
  app,
}) => {
  await expect(
    app.execute(ChatWorkflowStart, { text: "find me jobs in Haifa" }),
  ).rejects.toBeInstanceOf(CassetteMissingError);
});
