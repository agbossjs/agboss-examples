import { z } from "zod";
import type { JobText } from "./fit.helper.js";

const BoardResponse = z.object({
  jobs: z.array(
    z.object({
      title: z.string(),
      absolute_url: z.string(),
      updated_at: z.string(),
      location: z.object({ name: z.string() }).nullable().optional(),
      departments: z.array(z.object({ name: z.string() })).default([]),
      content: z.string().default(""),
    }),
  ),
});
type BoardJob = z.infer<typeof BoardResponse>["jobs"][number];

const ENTITIES: Readonly<Record<string, string>> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
  "&amp;": "&",
};
const decode = (text: string): string =>
  text.replace(/&(lt|gt|quot|#39|nbsp|amp);/g, (e) => ENTITIES[e] ?? e);

/** Greenhouse sends HTML with entities escaped: decode, drop tags, decode what is left. */
export const htmlToText = (encoded: string): string =>
  decode(decode(encoded).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

/** A job as the search sees it. */
export type Candidate = JobText & { readonly url: string; readonly updated: string };

export function candidateOf(
  board: string,
  job: BoardJob,
  companies: Readonly<Record<string, string>>,
): Candidate {
  return {
    company: companies[board] ?? board,
    title: job.title,
    location: job.location?.name ?? "",
    department: job.departments.map((d) => d.name).join(", "),
    text: htmlToText(job.content),
    url: job.absolute_url,
    updated: job.updated_at.slice(0, 10),
  };
}

export async function defaultFetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Greenhouse answered ${String(response.status)}`);
  return response.json();
}

/** Fetches (and caches) board jobs; failed boards are reported, not thrown. */
export function boardReader(
  fetchJson: (url: string) => Promise<unknown>,
  companies: Readonly<Record<string, string>>,
): (
  boards: readonly string[],
) => Promise<{ failedBoards: { board: string; error: string }[]; candidates: Candidate[] }> {
  const cache = new Map<string, Promise<BoardJob[]>>();
  const read = (board: string): Promise<BoardJob[]> => {
    const cached = cache.get(board);
    if (cached !== undefined) return cached;
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`;
    const pending = fetchJson(url).then((body) => BoardResponse.parse(body).jobs);
    pending.catch(() => cache.delete(board));
    cache.set(board, pending);
    return pending;
  };
  return async (boards: readonly string[]) => {
    const settled = await Promise.allSettled(boards.map(read));
    return {
      failedBoards: settled.flatMap((r, i) =>
        r.status === "rejected" ? [{ board: boards[i] ?? "", error: String(r.reason) }] : [],
      ),
      candidates: settled.flatMap((r, i) =>
        r.status === "fulfilled"
          ? r.value.map((job) => candidateOf(boards[i] ?? "", job, companies))
          : [],
      ),
    };
  };
}

const ProbeResponse = z.object({
  jobs: z.array(
    z.object({
      location: z.object({ name: z.string() }).nullable().optional(),
      company_name: z.string().optional(),
    }),
  ),
});

export type BoardProbe =
  | {
      readonly board: string;
      readonly company: string;
      readonly jobs: number;
      readonly inPlace: number;
    }
  | { readonly board: string; readonly error: string };

/** How many live jobs a board has, and how many of them are in a place (any of its words). */
export async function probeBoard(
  board: string,
  placeWords: readonly string[],
  fetchJson: (url: string) => Promise<unknown> = defaultFetchJson,
): Promise<BoardProbe> {
  try {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs`;
    const { jobs } = ProbeResponse.parse(await fetchJson(url));
    const words = placeWords.map((word) => word.toLowerCase());
    const inPlace = jobs.filter((job) => {
      const location = (job.location?.name ?? "").toLowerCase();
      return words.some((word) => location.includes(word));
    }).length;
    return { board, company: jobs[0]?.company_name ?? board, jobs: jobs.length, inPlace };
  } catch (error) {
    return { board, error: error instanceof Error ? error.message : String(error) };
  }
}
