import { describe, expect, it } from "vitest";
import { describeWorkflow, withProfile, workflowOf } from "graphinject";
import { JobScout } from "../src/job-scout.workflow.js";

describe("job-scout workflow", () => {
  it("assembles from its components; constructor dependencies resolved", async () => {
    const workflow = await workflowOf(JobScout);

    expect(workflow.config).toMatchObject({ name: "job-scout", version: "1.2.0" });
    expect(Object.keys(workflow.config.agents)).toEqual(["profiler", "scout", "shortlist"]);
    expect(workflow.toolDependencies).toEqual({
      greenhouse_jobs: "JobFitJudge (ROUTER_FACTORY), JOB_SEARCH",
    });
    expect(workflow.config.compaction).toMatchObject({ every: 5, keep: 10 });
  });

  it("the scout-low-thinking profile changes only the scout's thinking", async () => {
    const base = await workflowOf(JobScout);
    const profiled = await withProfile(
      base,
      "scout-low-thinking",
      new URL("..", import.meta.url).pathname,
    );

    expect(profiled.config.version).toBe("1.2.0-low-thinking");
    expect(profiled.config.agents.scout?.thinking).toBe("low");
    expect(profiled.config.agents.profiler).toEqual(base.config.agents.profiler);
  });
  it("AC4: every kind of component — tools, agents, injectable, MCP server and tools, knowledge base", async () => {
    const lines = describeWorkflow(await workflowOf(JobScout));
    const has = (text: string): boolean => lines.some((line) => line.includes(text));

    expect(lines[0]).toBe("job-scout 1.2.0");
    expect(has("· read_resume (read, local)")).toBe(true);
    expect(has("· greenhouse_jobs (read, local) ← JobFitJudge (ROUTER_FACTORY), JOB_SEARCH")).toBe(
      true,
    );
    expect(
      ["  profiler", "  scout", "  shortlist"].every((agent) =>
        lines.some((l) => l.startsWith(agent)),
      ),
    ).toBe(true);
    expect(has("· shortlist__read_text_file (read, MCP shortlist)")).toBe(true);
    expect(has("· shortlist__write_file (write, MCP shortlist, waits for approval)")).toBe(true);
    expect(has("rag: company_notes (tool, k 3)")).toBe(true);
    expect(has("· search_company_notes (read, local)")).toBe(true);
  });
});
