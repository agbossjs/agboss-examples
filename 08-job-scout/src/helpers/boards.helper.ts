import { z } from "zod";
import type { JobText } from "./fit.helper.js";

export const BoardResponse = z.object({
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
export type BoardJob = z.infer<typeof BoardResponse>["jobs"][number];

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
