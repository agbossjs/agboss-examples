import type { Candidate } from "./boards.helper.js";
import type { JobSearch } from "../config/search.config.js";
import { mapLimited, type FitJudge } from "./fit.helper.js";

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
export const JUDGE_CONCURRENCY = 8;

/** The hard filters of a search (the tool's input, as far as filtering needs it). */
export interface SearchFilters {
  readonly locations: readonly string[];
  readonly titleMustInclude: readonly string[];
  readonly excludeTitleWords: readonly string[];
}

export function passesFilters(
  job: Candidate,
  search: SearchFilters,
  places: JobSearch["places"],
): boolean {
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
export function fitScorer(
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
