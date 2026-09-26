import { McpTool, type ToolHandler } from "graphcompose";
import { z } from "zod";
import { SHORTLIST } from "../config/paths.js";
import { isMissingFile } from "../helpers/shortlist.helper.js";
import { ShortlistServer } from "./shortlist.server.js";

export const NoInput = z.object({});
export type NoInput = z.infer<typeof NoInput>;
export const Shortlist = z.object({ content: z.string() });
export type Shortlist = z.infer<typeof Shortlist>;

/** The user's shortlist, as saved. */
@McpTool({
  server: ShortlistServer,
  name: "read_shortlist",
  description: "Read the user's shortlist (empty when nothing is saved yet).",
  input: NoInput,
  output: Shortlist,
  deps: [ShortlistServer, SHORTLIST],
})
export class ReadShortlist implements ToolHandler<NoInput, Shortlist> {
  constructor(
    private readonly server: ShortlistServer,
    private readonly file: string,
  ) {}

  async run(): Promise<Shortlist> {
    try {
      return await this.server.call("read_text_file", { path: this.file });
    } catch (error) {
      if (isMissingFile(error)) return { content: "" };
      throw error;
    }
  }
}
