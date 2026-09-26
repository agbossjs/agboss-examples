import { Tool, type ToolHandler } from "graphcompose";
import { z } from "zod";
import { ResumeReader } from "../services/resume-reader.service.js";

export const ResumeRequest = z.object({ path: z.string().min(1) });
export type ResumeRequest = z.infer<typeof ResumeRequest>;
export const ResumeText = z.object({
  path: z.string(),
  requestedPath: z.string().optional(),
  format: z.enum(["pdf", "markdown", "text"]),
  text: z.string(),
  truncated: z.boolean(),
});
export type ResumeText = z.infer<typeof ResumeText>;

/** Reads the user's resume (PDF, Markdown, text). */
@Tool({
  name: "read_resume",
  description:
    "Read the user's resume from a local file (.pdf, .md or .txt). Pass the path exactly as the user gave it.",
  input: ResumeRequest,
  output: ResumeText,
  deps: [ResumeReader],
})
export class ReadResume implements ToolHandler<ResumeRequest, ResumeText> {
  constructor(private readonly reader: ResumeReader) {}

  run({ path }: ResumeRequest): Promise<ResumeText> {
    return this.reader.read(path);
  }
}
