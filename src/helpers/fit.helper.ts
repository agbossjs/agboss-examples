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
export const FIT =
  "Strong match: role, primary language / specialization and seniority fit, no deal-breakers.";
export const NO_FIT =
  "Not a match: different role or stack, wrong seniority, or a deal-breaker applies.";

/** The model gets this much of a job description. */
export const JOB_TEXT_CHARS = 2500;

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
