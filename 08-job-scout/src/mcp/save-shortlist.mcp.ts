import { Tool, type ToolHandler } from "@agboss/core";
import { SaveShortlistToolApproval } from "../approvals/save-shortlist.tool-approval.js";
import { SHORTLIST } from "../config/paths.js";
import { addJobs, isMissingFile } from "../helpers/shortlist.helper.js";
import { ChosenJobs, SavedJobs } from "./save-shortlist.dto.js";
import { ShortlistServer } from "./shortlist.server.js";

/** Adds the chosen jobs to the shortlist file; a job already there is skipped. Waits for approval. */
@Tool({
  name: "save-shortlist-tool",
  description: "Save the jobs the user chose to their shortlist (jobs already there are skipped).",
  approval: SaveShortlistToolApproval,
  input: ChosenJobs,
  output: SavedJobs,
  deps: [ShortlistServer, SHORTLIST],
})
export class SaveShortlist implements ToolHandler<ChosenJobs, SavedJobs> {
  constructor(
    private readonly server: ShortlistServer,
    private readonly file: string,
  ) {}

  execute = async ({ jobs }: ChosenJobs): Promise<SavedJobs> => {
    const { content, added, alreadyThere } = addJobs(await this.current(), jobs);
    if (added.length > 0) await this.server.call("write_file", { path: this.file, content });
    return { added, alreadyThere };
  };

  private async current(): Promise<string> {
    try {
      return (await this.server.call("read_text_file", { path: this.file })).content;
    } catch (error) {
      if (isMissingFile(error)) return "";
      throw error;
    }
  }
}
