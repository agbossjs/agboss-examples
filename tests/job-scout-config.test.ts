import { describe, expect, it } from "vitest";
import { probeBoard } from "../src/boards.js";
import { workflowOf } from "graphinject";
import { JobScout } from "../src/job-scout.workflow.js";
import { jobScoutPromptVariables } from "../src/prompt-variables.js";
import { jobSearchConfig, JobSearchSchema } from "../src/search.config.js";

describe("job-scout search config", () => {
  it("rejects a config without boards", () => {
    expect(() => JobSearchSchema.parse({ boards: {} })).toThrow(/at least one board/);
    expect(JobSearchSchema.parse({ boards: { acme: "Acme" } }).places).toEqual({});
  });

  it("ships an example config", () => {
    expect(Object.keys(jobSearchConfig.boards).length).toBeGreaterThan(10);
    expect(Object.keys(jobSearchConfig.places)).toContain("israel");
  });

  it("prompt variables list the configured boards and places", () => {
    const variables = jobScoutPromptVariables({
      boards: { acme: "Acme" },
      places: { germany: ["Berlin", "Munich"] },
    });

    expect(variables).toEqual({
      boards: "acme (Acme)",
      boardCount: "1",
      knownPlaces: "Places the search knows (they also match their cities): germany.",
    });
    expect(jobScoutPromptVariables({ boards: { acme: "Acme" }, places: {} }).knownPlaces).toContain(
      "matched literally",
    );
  });

  it("assembled prompts: every variable filled, the rules in place", async () => {
    const { prompts } = await workflowOf(JobScout);
    const boards = String(Object.keys(jobSearchConfig.boards).length);

    expect(prompts.profiler).not.toContain("{{");
    expect(prompts.scout).not.toContain("{{");
    expect(prompts.profiler).toContain("Proposed search brief:");
    expect(prompts.profiler).toContain(`Boards: all ${boards}`);
    expect(prompts.profiler).not.toMatch(/^\d\. /m);
    expect(prompts.scout).toContain("Never add a filter of your own.");
    // the list comes first and is never dropped for the notes-based explanation (found in #92 M1)
    const scout = prompts.scout ?? "";
    expect(scout.indexOf("numbered list")).toBeLessThan(scout.indexOf("search_company_notes"));
    expect(prompts.scout).toContain("Never drop this list");
    expect(prompts.scout).not.toMatch(/e\.g\. (Lead|Senior)/);
    expect(prompts.scout).toContain("they also match their cities): israel");
  });
});

describe("probeBoard", () => {
  const jobs = {
    jobs: [
      { location: { name: "Berlin, Germany" }, company_name: "Acme" },
      { location: { name: "Paris" } },
      { location: null },
    ],
  };

  it("counts live jobs and those in the place", async () => {
    expect(await probeBoard("acme", ["germany", "munich"], () => Promise.resolve(jobs))).toEqual({
      board: "acme",
      company: "Acme",
      jobs: 3,
      inPlace: 1,
    });
  });

  it("reports a board that fails", async () => {
    expect(await probeBoard("ghost", ["x"], () => Promise.reject(new Error("404")))).toEqual({
      board: "ghost",
      error: "404",
    });
  });
});
