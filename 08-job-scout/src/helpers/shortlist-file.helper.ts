import { basename, dirname } from "node:path";
import type { ShortlistServer } from "../mcp/shortlist.server.js";

/**
 * The shortlist file's text; empty when the file is not there yet. The framework reports every
 * failure of a server's tool as `McpError.Unavailable` (never the server's own text), so a missing
 * file cannot be told from the error of `read_text_file`: the folder is listed first.
 */
export async function shortlistText(server: ShortlistServer, file: string): Promise<string> {
  const { content: listing } = await server.call("list_directory", { path: dirname(file) });
  if (!listing.split("\n").includes(`[FILE] ${basename(file)}`)) return "";
  return (await server.call("read_text_file", { path: file })).content;
}
