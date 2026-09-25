import { Injectable, ROUTER_FACTORY, type Router } from "graphcompose";

/** What the judge sees of a job. */
export interface JobText {
  readonly company: string;
  readonly title: string;
  readonly location: string;
  readonly department: string;
  readonly text: string;
}

/** P(the job fits what the candidate wants), undefined when the judge failed; and what it cost. */
export type FitJudge = (
  profile: string,
  job: JobText,
) => Promise<{ readonly fit: number | undefined; readonly costUsd: number }>;

export const FIT_QUESTION =
  "Is this job a strong match for what the candidate wants? Any deal-breaker in the candidate's description rules the job out.";
const FIT =
  "Strong match: role, primary language / specialization and seniority fit, no deal-breakers.";
const NO_FIT = "Not a match: different role or stack, wrong seniority, or a deal-breaker applies.";

/** The model gets this much of a job description. */
export const JOB_TEXT_CHARS = 2500;

/** Rates how well a job fits what the candidate wants. */
export interface FitRater {
  rate: FitJudge;
}

/** Jev as the fit judge, from the core's router factory. */
@Injectable({ deps: [ROUTER_FACTORY] })
export class JobFitJudge implements FitRater {
  readonly rate: FitJudge;

  constructor(routers: (name: string) => Router) {
    this.rate = routerFitJudge(routers("job-fit"));
  }
}

/** A cheap per-job decision on the bundle's router model (Jev). */
export function routerFitJudge(router: Router): FitJudge {
  return async (profile, job) => {
    const outcome = await router.route({
      instructions: FIT_QUESTION,
      input: [
        `Candidate wants:\n${profile}`,
        `Job: ${job.title} — ${job.company}, ${job.location}`,
        `Department: ${job.department}`,
        job.text.slice(0, JOB_TEXT_CHARS),
      ].join("\n\n"),
      options: [
        { name: "fit", description: FIT },
        { name: "no_fit", description: NO_FIT },
      ],
    });
    const costUsd = outcome.usage?.costUsd ?? 0;
    if (outcome.kind === "failed") return { fit: undefined, costUsd };
    const confidence = outcome.decision.confidence ?? 1;
    return { fit: outcome.decision.next === "fit" ? confidence : 1 - confidence, costUsd };
  };
}

/** Runs `task` over `items` with at most `limit` in flight, keeping order. */
export async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
