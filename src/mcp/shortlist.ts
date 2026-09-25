import { McpServer, McpTool } from "graphcompose";
import { z } from "zod";
import { FILESYSTEM_SERVER, SHORTLIST_DIR } from "../paths.js";

/** The official filesystem MCP server, limited to the shortlist folder. */
@McpServer({
  name: "shortlist",
  transport: "stdio",
  command: process.execPath,
  args: [FILESYSTEM_SERVER, SHORTLIST_DIR],
})
export class ShortlistServer {}

const Text = z.object({ content: z.string() });

@McpTool({
  server: ShortlistServer,
  tool: "read_text_file",
  description: "Read the user's shortlist file (absolute path).",
  input: z.object({ path: z.string() }),
  output: Text,
})
export class ReadShortlist {}

/** Replaces the whole file — a `write` tool, so it waits for the user's approval. */
@McpTool({
  server: ShortlistServer,
  tool: "write_file",
  effect: "write",
  description: "Write the user's shortlist file (absolute path, the whole new content).",
  input: z.object({ path: z.string(), content: z.string() }),
  output: Text,
})
export class WriteShortlist {}
