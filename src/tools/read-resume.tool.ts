import { Tool, type ToolHandler } from "graphcompose";
import { z } from "zod";
import { resolve, extname } from "node:path";
import { readFile, stat } from "node:fs/promises";
import {
  expandHome,
  extractPdf,
  FORMATS,
  isFormatExt,
  MAX_FILE_BYTES,
  MAX_RESUME_CHARS,
  resolveResumePath,
  type PdfExtractor,
  type Resume,
} from "../helpers/resume.helper.js";

const ResumeInput = z.object({ path: z.string().min(1) });
const ResumeOutput = z.object({
  path: z.string(),
  requestedPath: z.string().optional(),
  format: z.enum(["pdf", "markdown", "text"]),
  text: z.string(),
  truncated: z.boolean(),
});

/** Reads a resume (PDF, Markdown, text); a slightly mangled path resolves in the same folder. */
@Tool({
  name: "read_resume",
  description:
    "Read the user's resume from a local file (.pdf, .md or .txt). Pass the path exactly as the user gave it.",
  input: ResumeInput,
  output: ResumeOutput,
})
export class ReadResume implements ToolHandler<typeof ResumeInput, typeof ResumeOutput> {
  constructor(private readonly pdf: PdfExtractor = extractPdf) {}

  async run({ path }: z.output<typeof ResumeInput>): Promise<Resume> {
    const resolved = await resolveResumePath(resolve(expandHome(path.trim())));
    const full = resolved.path;
    const ext = extname(full).toLowerCase();
    if (!isFormatExt(ext))
      throw new Error(`Unsupported resume format "${ext}" — use .pdf, .md or .txt`);
    if ((await stat(full)).size > MAX_FILE_BYTES)
      throw new Error("Resume file is larger than 5 MB");
    const bytes = await readFile(full);
    const format = FORMATS[ext];
    const raw = format === "pdf" ? await this.pdf(new Uint8Array(bytes)) : bytes.toString("utf8");
    const text = raw.replace(/[ \t]+/g, " ").trim();
    return {
      path: full,
      ...(resolved.requestedPath === undefined ? {} : { requestedPath: resolved.requestedPath }),
      format,
      text: text.slice(0, MAX_RESUME_CHARS),
      truncated: text.length > MAX_RESUME_CHARS,
    };
  }
}
