import { McpServer, McpServerClient, McpTransport } from "@agboss/core/mcp";
import { FILESYSTEM_SERVER, SHORTLIST_DIR } from "../config/paths.js";
import { DirectoryList, DirectoryListing, FileContent, FileRead, FileWrite, FileWritten } from "./shortlist.dto.js";

/** The server tools this workflow uses — checked against the server at startup. */
const tools = {
  list_directory: { input: DirectoryList, output: DirectoryListing },
  read_text_file: { input: FileRead, output: FileContent },
  write_file: { input: FileWrite, output: FileWritten },
};

/** The official filesystem MCP server, limited to the shortlist folder. */
@McpServer({
  name: "shortlist",
  transport: McpTransport.Stdio,
  command: process.execPath,
  args: [FILESYSTEM_SERVER, SHORTLIST_DIR],
  tools,
})
export class ShortlistServer extends McpServerClient<typeof tools> {}
