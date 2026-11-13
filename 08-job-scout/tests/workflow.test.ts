import { expect } from "vitest";
import { testWith } from "@agboss/core/testing";
import { JobScoutApplication } from "../src/job-scout.application.js";
import { ProfilerAgent } from "../src/agents/profiler.agent.js";
import { ScoutAgent } from "../src/agents/scout.agent.js";
import { ShortlistAgent } from "../src/agents/shortlist.agent.js";
import { MainRouter } from "../src/routers/main.router.js";
import { GreenhouseJobs } from "../src/tools/greenhouse-jobs.tool.js";
import { ReadResume } from "../src/tools/read-resume.tool.js";
import { ReadShortlist } from "../src/mcp/read-shortlist.mcp.js";
import { SaveShortlist } from "../src/mcp/save-shortlist.mcp.js";

const test = testWith(JobScoutApplication);

// The assembled workflow's config, tool dependencies and profile are `agboss check --strict` and
// `agboss describe` territory: the app below is assembled whole (its container creates every
// component with its constructor dependencies resolved), and each component is asked for by class.
test("job-scout assembles from its components; constructor dependencies resolved", async ({
  app,
}) => {
  await app.ready();

  expect(() => app.agent(ProfilerAgent)).not.toThrow();
  expect(() => app.agent(ScoutAgent)).not.toThrow();
  expect(() => app.agent(ShortlistAgent)).not.toThrow();
  expect(() => app.router(MainRouter)).not.toThrow();
  expect(() => app.tool(ReadResume)).not.toThrow();
  expect(() => app.tool(GreenhouseJobs)).not.toThrow();
  expect(() => app.tool(ReadShortlist)).not.toThrow();
  expect(() => app.tool(SaveShortlist)).not.toThrow();
});
