import { McpServer, McpServerClient } from "graphcompose";
import { z } from "zod";
import { FILESYSTEM_SERVER, SHORTLIST_DIR } from "../config/paths.js";

export const FilePath = z.object({ path: z.string() });
export type FilePath = z.infer<typeof FilePath>;
export const FileWrite = z.object({ path: z.string(), content: z.string() });
export type FileWrite = z.infer<typeof FileWrite>;
export const FileText = z.object({ content: z.string() });
export type FileText = z.infer<typeof FileText>;

/** The server tools this workflow uses — checked against the server at startup. */
const tools = {
  read_text_file: { input: FilePath, output: FileText },
  write_file: { input: FileWrite, output: FileText },
};

/** The official filesystem MCP server, limited to the shortlist folder. */
@McpServer({
  name: "shortlist",
  transport: "stdio",
  command: process.execPath,
  args: [FILESYSTEM_SERVER, SHORTLIST_DIR],
  tools,
})
export class ShortlistServer extends McpServerClient<typeof tools> {}
