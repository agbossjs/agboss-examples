import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { configureEnv, env } from "@agboss/core";
import { testWith } from "@agboss/core/testing";
import { JobScoutApplication } from "../src/job-scout.application.js";
import { jobScoutEnv } from "../src/job-scout.env.js";
import { GreenhouseJobs } from "../src/tools/greenhouse-jobs.tool.js";

const query = {
  profile: "Senior backend engineer, TypeScript and Node.js",
  locations: ["israel"],
  titleMustInclude: [],
  excludeTitleWords: [],
  skills: [],
  boards: ["fireblocks"],
  count: 5,
  minFit: 0,
};

/** Every board request the app makes, answered with an empty board (no network). */
function recordBoardRequests(): string[] {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      urls.push(url);
      return Promise.resolve(Response.json({ jobs: [] }));
    }),
  );
  return urls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// dev's records go to .agboss/job-scout.sqlite; a test on dev's values keeps them in memory; dev
// reads the model key (a developer's .env) — no test calls a model with it
beforeAll(() => {
  vi.stubEnv("AGBOSS_SQLITE_PATH", ":memory:");
  vi.stubEnv("OPENROUTER_API_KEY", "test-key-never-sent");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

// `npm run chat` (the app) defaults to dev; testWith defaults to test.config.ts (#261).
const asChat = testWith(JobScoutApplication, { profile: "dev" });
const bare = testWith(JobScoutApplication);
const asTest = testWith(JobScoutApplication, { profile: "test" });

describe("#182: the app's environment reaches GreenhouseBoards", () => {
  asChat(
    "AC1: the app's default (npm run chat, no --profile) is dev.config.ts: the real board API",
    async ({ app }) => {
      const urls = recordBoardRequests();

      await app.runTool(GreenhouseJobs, query);

      expect(urls).toEqual([
        "https://boards-api.greenhouse.io/v1/boards/fireblocks/jobs?content=true",
      ]);
    },
  );

  bare(
    "testWith without a profile → test.config.ts (tests never hit the real API by default)",
    async ({ app }) => {
      const urls = recordBoardRequests();

      await app.runTool(GreenhouseJobs, query);

      expect(urls).toEqual(["https://greenhouse.test/v1/boards/fireblocks/jobs?content=true"]);
    },
  );

  asTest('{ profile: "test" } → test.environment.ts', async ({ app }) => {
    const urls = recordBoardRequests();

    await app.runTool(GreenhouseJobs, query);

    expect(urls).toEqual(["https://greenhouse.test/v1/boards/fireblocks/jobs?content=true"]);
  });
});

describe("#261 AC8: the profile's values are typed by the defineEnv dictionary", () => {
  it("a key the dictionary does not have, or of the wrong type, is a tsc error", () => {
    // @ts-expect-error — greenhouseApiUrl is a string, not a number
    const mistyped = configureEnv(jobScoutEnv, { greenhouseApiUrl: 42 });
    // @ts-expect-error — a key the dictionary does not declare
    const unknown = configureEnv(jobScoutEnv, { greenhouseUrl: "https://greenhouse.test" });
    const ok = configureEnv(jobScoutEnv, { greenhouseApiUrl: "https://greenhouse.test" });
    expect([mistyped, unknown, ok]).toHaveLength(3);
  });

  it("the variable of the dictionary is a reference of its own: GREENHOUSE_API_URL, read when the app starts", () => {
    expect(jobScoutEnv.greenhouseApiUrl).toEqual(env("GREENHOUSE_API_URL"));
  });
});
