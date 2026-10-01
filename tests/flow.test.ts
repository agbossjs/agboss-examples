import { describe, expect, it } from "vitest";
import { describeWorkflow, workflowOf } from "graphcompose";
import { JobScout } from "../src/job-scout.workflow.js";

const workflow = await workflowOf(JobScout);

describe("job-scout on the flow graph (#116)", () => {
  it("AC1: the flow assembles as a star — workflow start → main router ⇄ agents → workflow finish", () => {
    const lines = describeWorkflow(workflow);

    expect(lines).toEqual(
      expect.arrayContaining([
        "flow",
        "  chat (workflow start) → main",
        "  main → profiler | scout | shortlist | chat (workflow finish)",
        "  profiler, scout, shortlist → main",
      ]),
    );
    expect(Object.keys(workflow.config.agents)).toEqual(["profiler", "scout", "shortlist"]);
  });

  it("AC1: the main router is Jev, at most 3 visits a run, its routes sorted by name", () => {
    const [main] = workflow.routers;

    expect(workflow.routers).toHaveLength(1);
    expect(main).toMatchObject({ name: "main", model: "typesafe/jev-1.13", maxVisits: 3 });
    expect(main?.routes.map((item) => item.option)).toEqual([
      "chat",
      "profiler",
      "scout",
      "shortlist",
    ]);
    expect(describeWorkflow(workflow)).toContain(
      "  main  jev typesafe/jev-1.13 · maxVisits 3 — Sends the job seeker's message to the right agent, or sends the answer",
    );
  });

  it("AC1: limits come from settings() — 12 steps and $0.10 a run, $1 a day", () => {
    expect(workflow.limits).toEqual({ perRun: { steps: 12, cost: 0.1 }, perDay: { cost: 1 } });
    expect(describeWorkflow(workflow)).toContain("limits    run 12 steps · $0.1 · day $1");
  });

  it("AC1: guards, the approval pause and compaction stay on", () => {
    expect(workflow.config.guards?.input).toHaveProperty("prompt_injection");
    expect(workflow.config.guards?.output).toHaveProperty("pii");
    expect(workflow.needsApproval).toBeDefined();
    expect(workflow.config.compaction).toMatchObject({ every: 5, keep: 10 });
  });
});
