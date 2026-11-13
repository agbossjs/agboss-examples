import { secret } from "@agboss/core";
import { describe, expect, it } from "vitest";
import { testExecutionContext } from "@agboss/core/testing";
import { GreenhouseBoards, type FetchJson } from "../src/services/greenhouse-boards.service.js";

/** The application context of the dev environment: the public board API. */
const { application } = testExecutionContext({
  application: {
    environment: {
      greenhouseApiUrl: "https://boards-api.greenhouse.io",
      sqlitePath: ":memory:",
      piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
    },
  },
}).tenant;

const probeBoard = (board: string, words: readonly string[], fetchJson: FetchJson) =>
  new GreenhouseBoards({ boards: {}, places: {} }, application, fetchJson).probe(board, words);
import { replyWith, routeTo, testWith, type ModelRequest } from "@agboss/core/testing";
import { JobScoutApplication } from "../src/job-scout.application.js";
import { ProfilerAgent } from "../src/agents/profiler.agent.js";
import { ScoutAgent } from "../src/agents/scout.agent.js";
import { MainRouter } from "../src/routers/main.router.js";
import { ChatWorkflowStart } from "../src/workflow-starts/chat.workflow-start.js";
import { jobScoutPromptVariables } from "../src/config/prompt-variables.js";
import { jobSearchConfig, JobSearchSchema } from "../src/config/search.config.js";

const test = testWith(JobScoutApplication);

const systemOf = (request: ModelRequest): string => (request.kind === "chat" ? request.system : "");

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

  test("assembled prompts: every variable filled, the rules in place", async ({ app, mockLlm }) => {
    // the system prompts the two agents' models are given: what assembly made of them
    mockLlm(MainRouter).thenReturn(routeTo(ProfilerAgent), routeTo(ScoutAgent));
    mockLlm(ProfilerAgent).thenReturn(replyWith("brief"));
    mockLlm(ScoutAgent).thenReturn(replyWith("jobs"));
    await app.execute(ChatWorkflowStart, { text: "propose a brief" });
    await app.execute(ChatWorkflowStart, { text: "search" });
    const p = systemOf(mockLlm(ProfilerAgent).onlyRequest);
    const s = systemOf(mockLlm(ScoutAgent).onlyRequest);
    const boards = String(Object.keys(jobSearchConfig.boards).length);

    expect(p).not.toContain("{{");
    expect(s).not.toContain("{{");
    expect(p).toContain("Proposed search brief:");
    expect(p).toContain(`Boards: all ${boards}`);
    expect(p).not.toMatch(/^\d\. /m);
    expect(s).toContain("Never add a filter of your own.");
    // the list comes first and is never dropped for the notes-based explanation (found in #92 M1)
    expect(s.indexOf("numbered list")).toBeLessThan(s.indexOf("search-company-notes-rag-tool"));
    expect(s).toContain("Never drop this list");
    expect(s).not.toMatch(/e\.g\. (Lead|Senior)/);
    expect(s).toContain("they also match their cities): israel");
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
