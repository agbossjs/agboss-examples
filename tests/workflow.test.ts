import { describe, expect, it } from "vitest";
import { withProfile, workflowOf } from "graphinject";
import { JobScout } from "../src/job-scout.workflow.js";

describe("job-scout workflow", () => {
  it("assembles from its components; constructor dependencies resolved", async () => {
    const workflow = await workflowOf(JobScout);

    expect(workflow.config).toMatchObject({ name: "job-scout", version: "1.1.0" });
    expect(Object.keys(workflow.config.agents)).toEqual(["profiler", "scout"]);
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

    expect(profiled.config.version).toBe("1.1.0-low-thinking");
    expect(profiled.config.agents.scout?.thinking).toBe("low");
    expect(profiled.config.agents.profiler).toEqual(base.config.agents.profiler);
  });
});
