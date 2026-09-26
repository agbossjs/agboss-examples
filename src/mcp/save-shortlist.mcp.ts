import { McpTool, type ToolHandler } from "graphcompose";
import { z } from "zod";
import { SHORTLIST } from "../config/paths.js";
import { addJobs, isMissingFile } from "../helpers/shortlist.helper.js";
import { ShortlistServer } from "./shortlist.server.js";

export const ChosenJobs = z.object({
  jobs: z
    .array(
      z.object({
        title: z.string(),
        company: z.string(),
        location: z.string(),
        link: z.string().describe("the job's link, exactly as in the list"),
        fit: z.number().min(0).max(100).optional().describe("the fit shown in the list, %"),
      }),
    )
    .min(1)
    .describe("the jobs the user chose, copied from the list shown"),
});
export type ChosenJobs = z.infer<typeof ChosenJobs>;
export const SavedJobs = z.object({
  added: z.array(z.string()),
  alreadyThere: z.array(z.string()),
});
export type SavedJobs = z.infer<typeof SavedJobs>;

/** Adds the chosen jobs to the shortlist file; a job already there is skipped. Waits for approval. */
@McpTool({
  server: ShortlistServer,
  name: "save_shortlist",
  description: "Save the jobs the user chose to their shortlist (jobs already there are skipped).",
  effect: "write",
  input: ChosenJobs,
  output: SavedJobs,
  deps: [ShortlistServer, SHORTLIST],
})
export class SaveShortlist implements ToolHandler<ChosenJobs, SavedJobs> {
  constructor(
    private readonly server: ShortlistServer,
    private readonly file: string,
  ) {}

  async run({ jobs }: ChosenJobs): Promise<SavedJobs> {
    const { content, added, alreadyThere } = addJobs(await this.current(), jobs);
    if (added.length > 0) await this.server.call("write_file", { path: this.file, content });
    return { added, alreadyThere };
  }

  private async current(): Promise<string> {
    try {
      return (await this.server.call("read_text_file", { path: this.file })).content;
    } catch (error) {
      if (isMissingFile(error)) return "";
      throw error;
    }
  }
}
