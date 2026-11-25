import { Tool, type ToolHandler } from "@agboss/core";
import { NoInputDto } from "@agboss/core/dto";
import { SHORTLIST } from "../config/paths.js";
import { isMissingFile } from "../helpers/shortlist.helper.js";
import { ShortlistContent } from "./read-shortlist.dto.js";
import { ShortlistServer } from "./shortlist.server.js";

/** The user's shortlist, as saved. */
@Tool({
  name: "read-shortlist-tool",
  description: "Read the user's shortlist (empty when nothing is saved yet).",
  input: NoInputDto,
  output: ShortlistContent,
  deps: [ShortlistServer, SHORTLIST],
})
export class ReadShortlist implements ToolHandler<NoInputDto, ShortlistContent> {
  constructor(
    private readonly server: ShortlistServer,
    private readonly file: string,
  ) {}

  async execute(): Promise<ShortlistContent> {
    try {
      return await this.server.call("read_text_file", { path: this.file });
    } catch (error) {
      if (isMissingFile(error)) return { content: "" };
      throw error;
    }
  }
}
