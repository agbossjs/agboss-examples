import { Decision, DecisionModel, ExecutionContext, Injectable, provide, Tool } from "@agboss/core";
import { testExecutionContext, testService, testUnit } from "@agboss/core/testing";
import { describe, expect, it, vi } from "vitest";
import { FIT_QUESTION, mapLimited, type FitJudge } from "../src/helpers/fit.helper.js";
import { JobMatches, JobQuery } from "../src/tools/greenhouse-jobs.dto.js";
import { GreenhouseJobs } from "../src/tools/greenhouse-jobs.tool.js";
import { GreenhouseBoards } from "../src/services/greenhouse-boards.service.js";
import { JobFitJudge } from "../src/services/job-fit.service.js";

/** The application context of the dev environment: the public board API. */
const { application } = testExecutionContext({
  application: {
    environment: {
      greenhouseApiUrl: "https://boards-api.greenhouse.io",
    },
  },
}).tenant;

import type { JobSearch } from "../src/config/search.js";

/** A test config: its own boards and places — nothing from the shipped example. */
const testSearch: JobSearch = {
  boards: { fireblocks: "Fireblocks", similarweb: "Similarweb", jfrog: "JFrog", ghost: "Ghost" },
  places: { israel: ["Israel", "Tel Aviv", "Herzliya", "Or Yehuda"] },
};

const board = (jobs: object[]) => ({ jobs });
const job = (title: string, location: string, content: string) => ({
  title,
  absolute_url: `https://example.com/${title.replace(/\s/g, "-")}`,
  updated_at: "2026-09-20T10:00:00-04:00",
  location: { name: location },
  departments: [{ name: "R&D" }],
  content,
});

const boards: Record<string, object> = {
  fireblocks: board([
    job(
      "Senior Backend Engineer",
      "Tel Aviv-Yafo, Tel Aviv District, Israel",
      "&lt;p&gt;Java, Kotlin, Kafka&lt;/p&gt;",
    ),
    job("Team Lead, Backend", "Tel Aviv, Israel", "Java"),
    job("Backend Engineer", "New York", "Java"),
  ]),
  similarweb: board([job("Backend Engineer, Platform", "Tel Aviv", "Kotlin and Spring")]),
  jfrog: board([job("Sales Engineer", "Herzliya, Israel", "sales")]),
};

const fetchJson = vi.fn((url: string) => {
  const token = /boards\/([^/]+)\/jobs/.exec(url)?.[1] ?? "";
  const body = boards[token];
  return body === undefined ? Promise.reject(new Error("404")) : Promise.resolve(body);
});

/** Fits by title word; "Sales" is a no-fit; costs $0.00002 per decision. */
const judge = vi.fn<FitJudge>((_profile, j) =>
  Promise.resolve({
    fit: j.title.includes("Sales") ? 0.1 : j.title.includes("Senior") ? 0.9 : 0.7,
    costUsd: 0.00002,
  }),
);

/** What the fakes below call: a test says which judge and which board fetch it runs on. */
let judgeImpl: FitJudge = judge;
let fetchImpl: (url: string) => Promise<unknown> = fetchJson;

@Injectable()
class FakeJudge {
  rate: FitJudge = (profile, j) => judgeImpl(profile, j);
}

@Injectable()
class FakeSearch {
  readonly boards = testSearch.boards;
  readonly places = testSearch.places;
}

@Injectable()
class FakeBoards extends GreenhouseBoards {
  constructor() {
    super(testSearch, application, (url) => fetchImpl(url));
  }
}

/** The tool with its dependencies replaced: the same class and `run`, the container makes it. */
@Tool({
  name: "greenhouse-jobs-tool",
  description: "The greenhouse tool on fake dependencies.",
  input: JobQuery,
  output: JobMatches,
  deps: [FakeJudge, FakeSearch, FakeBoards, ExecutionContext],
})
class TestGreenhouseJobs extends GreenhouseJobs {}

const greenhouse = (deps: { judge?: FitJudge; fetchJson?: (url: string) => Promise<unknown> }) => {
  judgeImpl = deps.judge ?? judge;
  fetchImpl = deps.fetchJson ?? fetchJson;
  return testUnit(TestGreenhouseJobs);
};

const search = {
  profile: "Senior backend, Java or Kotlin primary; no management roles",
  locations: ["Israel"],
  excludeTitleWords: ["Team Lead"],
  skills: ["Java", "Kotlin", "Kafka"],
  boards: ["fireblocks", "similarweb", "jfrog", "ghost"],
};

/** A tool input as the model fills it, the DTO's defaults written out. */
const query = (over: Partial<JobQuery> = {}): JobQuery => ({
  titleMustInclude: [],
  count: 20,
  minFit: 0,
  ...search,
  ...over,
});

describe("greenhouse-jobs-tool", () => {
  it("filters hard, lets the judge rank the rest and returns the best with links", async () => {
    const tool = greenhouse({});

    const { output } = await tool(query({ minFit: 0.5 }));

    expect(output.jobs.map((j) => [j.company, j.title, j.fit])).toEqual([
      ["Fireblocks", "Senior Backend Engineer", 90],
      ["Similarweb", "Backend Engineer, Platform", 70],
    ]);
    expect(output.jobs[0]?.matchedSkills).toEqual(["Java", "Kotlin", "Kafka"]);
    expect(output).toMatchObject({ afterFilters: 3, judged: 3, passed: 2, judgeFailures: 0 });
    expect(output.failedBoards).toEqual([{ board: "ghost", error: "Error: 404" }]);
  });

  it("ranks everything by default (no floor)", async () => {
    const tool = greenhouse({});

    const { output } = await tool(query());

    expect(output.jobs.map((j) => j.fit)).toEqual([90, 70, 10]);
  });

  it("caches boards and judgements for the same profile", async () => {
    fetchJson.mockClear();
    judge.mockClear();
    const tool = greenhouse({});

    await tool(query({ boards: ["similarweb"] }));
    await tool(query({ boards: ["similarweb"], count: 5 }));

    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(judge).toHaveBeenCalledTimes(1);
  });

  it("uses all configured boards by default and counts judge failures", async () => {
    const failing: FitJudge = () => Promise.resolve({ fit: undefined, costUsd: 0 });
    const tool = greenhouse({ judge: failing });

    const { output } = await tool(query({ boards: [], skills: [], excludeTitleWords: [] }));

    expect(output.searched).toEqual([
      "fireblocks",
      "similarweb",
      "jfrog",
      "ghost",
    ]);
    expect(output.judgeFailures).toBe(4);
  });
});

describe("JobFitJudge (Jev per job)", () => {
  const jobText = {
    company: "Acme",
    title: "Backend",
    location: "Haifa",
    department: "R&D",
    text: "Java",
  };

  it("asks the decision model the fit question and returns P(fit); the framework records the cost", async () => {
    const decide = vi.fn().mockResolvedValue({
      fits: { type: "boolean", probability: 0.8 },
    });
    const judge = testService(JobFitJudge, { services: [provide(DecisionModel, { decide })] });

    const { output } = await judge.run((service) => service.rate("Java backend", jobText));

    expect(output).toEqual({ fit: 0.8, costUsd: 0 });
    expect(decide.mock.calls[0]?.[0].questions).toEqual({ fits: Decision.boolean(FIT_QUESTION) });
  });

  it("reports a failed decision as no fit value", async () => {
    const decide = vi.fn().mockRejectedValue(new Error("down"));
    const judge = testService(JobFitJudge, { services: [provide(DecisionModel, { decide })] });

    const { output } = await judge.run((service) => service.rate("x", jobText));

    expect(output).toEqual({ fit: undefined, costUsd: 0 });
  });

  it("mapLimited keeps order under a concurrency limit", async () => {
    expect(await mapLimited([3, 1, 2], 2, (n) => Promise.resolve(n * 10))).toEqual([30, 10, 20]);
  });
});

describe("hard filters", () => {
  it("keeps only titles with a required word and drops excluded ones, before the judge", async () => {
    judge.mockClear();
    const tool = greenhouse({});

    const { output } = await tool(
      query({ titleMustInclude: ["Senior"], excludeTitleWords: ["Lead"] }),
    );

    expect(output.jobs.map((j) => j.title)).toEqual([
      "Senior Backend Engineer",
    ]);
    expect(judge).toHaveBeenCalledTimes(1);
  });

  it("matches Israeli cities for Israel", async () => {
    const tool = greenhouse({
      fetchJson: () =>
        Promise.resolve(
          board([job("Backend", "Or Yehuda", "Java"), job("Backend", "Berlin", "Java")]),
        ),
    });

    const { output } = await tool(query({ boards: ["x"], excludeTitleWords: [] }));

    expect(output.jobs.map((j) => j.location)).toEqual(["Or Yehuda"]);
  });
});
