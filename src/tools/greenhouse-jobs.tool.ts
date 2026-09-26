import { Tool, type ToolContext, type ToolHandler } from "graphcompose";
import { z } from "zod";
import type { Candidate } from "../helpers/boards.helper.js";
import { GreenhouseBoards } from "../services/greenhouse-boards.service.js";
import { fitScorer, matchScore, MAX_JUDGED, passesFilters } from "../helpers/greenhouse.helper.js";
import { JOB_SEARCH, type JobSearch } from "../config/search.config.js";
import { JobFitJudge, type FitRater } from "../services/job-fit.service.js";

export const JobQuery = z.object({
  profile: z
    .string()
    .min(20)
    .describe(
      "What the user wants: role, primary languages, specialization, seniority, deal-breakers",
    ),
  locations: z
    .array(z.string())
    .min(1)
    .describe("Places or cities; a configured place (e.g. a country) also matches its cities"),
  titleMustInclude: z
    .array(z.string())
    .default([])
    .describe(
      "Keep only jobs whose title has any of these words, e.g. Senior — applied before the judge",
    ),
  excludeTitleWords: z
    .array(z.string())
    .default([])
    .describe("Drop jobs whose title has any, e.g. Team Lead, Manager"),
  skills: z
    .array(z.string())
    .default([])
    .describe("Skills from the resume — shown as matched skills"),
  boards: z.array(z.string()).default([]).describe("Board tokens; empty = all configured boards"),
  count: z.number().int().min(1).max(50).default(20),
  minFit: z
    .number()
    .min(0)
    .max(1)
    .default(0)
    .describe(
      "Optional floor on the judge's P(fit); 0 = rank only (the judge ranks well, its probabilities are compressed)",
    ),
});

const Job = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string(),
  department: z.string(),
  url: z.string(),
  updated: z.string(),
  fit: z.number(),
  matchedSkills: z.array(z.string()),
});

export const JobMatches = z.object({
  searched: z.array(z.string()),
  failedBoards: z.array(z.object({ board: z.string(), error: z.string() })),
  afterFilters: z.number(),
  judged: z.number(),
  judgeFailures: z.number(),
  passed: z.number(),
  jobs: z.array(Job),
});

export type JobQuery = z.infer<typeof JobQuery>;
export type JobMatches = z.infer<typeof JobMatches>;

/**
 * Public Greenhouse boards (no key): hard filters (location, excluded titles), then a cheap judge
 * (Jev) rates every remaining job against what the user wants; the best `count` come back with
 * links. Board responses and judgements are cached per instance; judge spend is reported.
 */
@Tool({
  name: "greenhouse_jobs",
  description:
    "Find jobs on Greenhouse boards that fit what the user wants; returns the best with links.",
  input: JobQuery,
  output: JobMatches,
  timeoutMs: 240_000,
  deps: [JobFitJudge, JOB_SEARCH, GreenhouseBoards],
})
export class GreenhouseJobs implements ToolHandler<JobQuery, JobMatches> {
  private readonly score: ReturnType<typeof fitScorer>;

  constructor(
    judge: FitRater,
    private readonly search: JobSearch,
    private readonly boards: GreenhouseBoards,
  ) {
    this.score = fitScorer((profile, job) => judge.rate(profile, job));
  }

  async run(input: JobQuery, ctx: ToolContext): Promise<JobMatches> {
    const requested = input.boards.length > 0 ? input.boards : Object.keys(this.search.boards);
    const boards = [...new Set(requested.map((board) => board.trim().toLowerCase()))];
    const { failedBoards, candidates } = await this.boards.jobs(boards);
    const filtered = candidates.filter((job) => passesFilters(job, input, this.search.places));
    const judgedJobs = filtered.slice(0, MAX_JUDGED);
    const { fits, costUsd } = await this.score(input.profile, judgedJobs);
    ctx.reportCost(costUsd);
    const passed = judgedJobs
      .map((job, i) => ({ job, fit: fits[i] }))
      .filter(
        (item): item is { job: Candidate; fit: number } =>
          item.fit !== undefined && item.fit >= input.minFit,
      )
      .sort((a, b) => b.fit - a.fit || b.job.updated.localeCompare(a.job.updated));
    return {
      searched: boards,
      failedBoards,
      afterFilters: filtered.length,
      judged: judgedJobs.length,
      judgeFailures: fits.filter((fit) => fit === undefined).length,
      passed: passed.length,
      jobs: passed.slice(0, input.count).map(({ job, fit }) => ({
        company: job.company,
        title: job.title,
        location: job.location,
        department: job.department,
        url: job.url,
        updated: job.updated,
        fit: Math.round(fit * 100),
        matchedSkills: matchScore(input.skills, `${job.title} ${job.text}`).matched,
      })),
    };
  }
}
