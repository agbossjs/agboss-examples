/** One job the user chose, as the shortlist keeps it. */
export interface ChosenJob {
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly link: string;
  /** the fit shown in the list, 0–100 */
  readonly fit?: number | undefined;
}

const HEADER = "# Shortlist\n";

export const shortlistLine = (job: ChosenJob): string =>
  `- [${job.title} — ${job.company}, ${job.location}](${job.link})${job.fit === undefined ? "" : ` · fit ${String(job.fit)}%`}`;

/** The shortlist with the new jobs added; a job whose link is already there is skipped. */
export function addJobs(
  current: string,
  jobs: readonly ChosenJob[],
): { content: string; added: string[]; alreadyThere: string[] } {
  const fresh = jobs.filter(
    (job, index) =>
      !current.includes(`(${job.link})`) &&
      jobs.findIndex((other) => other.link === job.link) === index,
  );
  const lines = fresh.map(shortlistLine);
  const base = current.trim() === "" ? HEADER : `${current.trimEnd()}\n`;
  return {
    content: lines.length === 0 ? current : `${base}${lines.join("\n")}\n`,
    added: fresh.map((job) => job.title),
    alreadyThere: jobs.filter((job) => !fresh.includes(job)).map((job) => job.title),
  };
}

/** A file the server could not find is an empty shortlist; any other error stays an error. */
export const isMissingFile = (error: unknown): boolean =>
  /ENOENT|no such file|not found/i.test(error instanceof Error ? error.message : String(error));
