import { Tool, type ToolContext, type ToolHandler } from "graphinject";
export { htmlToText } from "../boards.js";
import { z } from "zod";
import { boardReader, defaultFetchJson, type Candidate } from "../boards.js";
import { JOB_SEARCH, type JobSearch } from "../search.config.js";
import { JobFitJudge, mapLimited, type FitJudge, type FitRater } from "../fit.js";

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mentions = (text: string, term: string): boolean =>
  new RegExp(`(^|[^a-z0-9])${escapeRegExp(term.toLowerCase())}($|[^a-z0-9])`).test(text);

/** Share of the resume skills a job mentions, 0–100, and which ones. */
export function matchScore(
  skills: readonly string[],
  text: string,
): { score: number; matched: string[] } {
  const haystack = text.toLowerCase();
  const matched = skills.filter((skill) => skill.trim() !== "" && mentions(haystack, skill.trim()));
  return {
    score: skills.length === 0 ? 0 : Math.round((100 * matched.length) / skills.length),
    matched,
  };
}

/** A configured place expands to its words; anything else matches literally. */
const locationTerms = (locations: readonly string[], places: JobSearch["places"]): string[] =>
  locations.flatMap((location) => {
    const key = location.trim().toLowerCase();
    return places[key]?.map((word) => word.toLowerCase()) ?? [key];
  });

/** At most this many jobs are judged per search — bounds time and cost. */
export const MAX_JUDGED = 400;
const JUDGE_CONCURRENCY = 8;

const Input = z.object({
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

const Output = z.object({
  searched: z.array(z.string()),
  failedBoards: z.array(z.object({ board: z.string(), error: z.string() })),
  afterFilters: z.number(),
  judged: z.number(),
  judgeFailures: z.number(),
  passed: z.number(),
  jobs: z.array(Job),
});

type Search = z.output<typeof Input>;

function passesFilters(job: Candidate, search: Search, places: JobSearch["places"]): boolean {
  const location = job.location.toLowerCase();
  const title = job.title.toLowerCase();
  return (
    locationTerms(search.locations, places).some((term) => location.includes(term)) &&
    (search.titleMustInclude.length === 0 ||
      search.titleMustInclude.some((word) => title.includes(word.trim().toLowerCase()))) &&
    !search.excludeTitleWords.some((word) => title.includes(word.trim().toLowerCase()))
  );
}

/** Judges each job once per profile (cached); returns fits and the cost of new decisions. */
function fitScorer(
  judge: FitJudge,
): (
  profile: string,
  jobs: readonly Candidate[],
) => Promise<{ fits: (number | undefined)[]; costUsd: number }> {
  const cache = new Map<string, Promise<number | undefined>>();
  return async (profile: string, jobs: readonly Candidate[]) => {
    let costUsd = 0;
    const fits = await mapLimited(jobs, JUDGE_CONCURRENCY, (job) => {
      const key = `${profile}\u0000${job.url}`;
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      const pending = judge(profile, job).then((result) => {
        costUsd += result.costUsd;
        return result.fit;
      });
      cache.set(key, pending);
      return pending;
    });
    return { fits, costUsd };
  };
}

/**
 * Public Greenhouse boards (no key): hard filters (location, excluded titles), then a cheap judge
 * (Jev) rates every remaining job against what the user wants; the best `count` come back with
 * links. Board responses and judgements are cached per instance; judge spend is reported.
 */
@Tool({
  name: "greenhouse_jobs",
  description:
    "Find jobs on Greenhouse boards that fit what the user wants; returns the best with links.",
  input: Input,
  output: Output,
  timeoutMs: 240_000,
  deps: [JobFitJudge, JOB_SEARCH],
})
export class GreenhouseJobs implements ToolHandler<typeof Input, typeof Output> {
  private readonly readBoards: ReturnType<typeof boardReader>;
  private readonly score: ReturnType<typeof fitScorer>;

  constructor(
    judge: FitRater,
    private readonly search: JobSearch,
    fetchJson: (url: string) => Promise<unknown> = defaultFetchJson,
  ) {
    this.readBoards = boardReader(fetchJson, search.boards);
    this.score = fitScorer((profile, job) => judge.rate(profile, job));
  }

  async run(input: Search, ctx: ToolContext): Promise<z.output<typeof Output>> {
    const requested = input.boards.length > 0 ? input.boards : Object.keys(this.search.boards);
    const boards = [...new Set(requested.map((board) => board.trim().toLowerCase()))];
    const { failedBoards, candidates } = await this.readBoards(boards);
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
