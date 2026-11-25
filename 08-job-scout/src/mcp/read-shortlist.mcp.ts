import { Tool, type ToolHandler } from "@agboss/core";
import { NoInputDto } from "@agboss/core/dto";
import { SHORTLIST } from "../config/paths.js";
import { shortlistText } from "../helpers/shortlist-file.helper.js";
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
    return { content: await shortlistText(this.server, this.file) };
  }
}
