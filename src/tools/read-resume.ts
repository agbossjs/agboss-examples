import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { Tool, type ToolHandler } from "graphinject";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** The model gets at most this much resume text. */
export const MAX_RESUME_CHARS = 20_000;

export type PdfExtractor = (bytes: Uint8Array) => Promise<string>;

const extractPdf: PdfExtractor = async (bytes) => {
  const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true });
  return text;
};

const FORMATS = { ".pdf": "pdf", ".md": "markdown", ".txt": "text" } as const;
type Format = (typeof FORMATS)[keyof typeof FORMATS];

const isFormatExt = (ext: string): ext is keyof typeof FORMATS => ext in FORMATS;

interface Resume {
  readonly path: string;
  /** The path that was asked for, when it did not exist and a near match was read instead. */
  readonly requestedPath?: string;
  readonly format: Format;
  readonly text: string;
  readonly truncated: boolean;
}

/** Name for near-match comparison: case, underscores, spaces and dashes do not matter. */
const looseName = (name: string): string => name.toLowerCase().replace(/[\s_-]+/g, "");

const exists = async (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  );

/**
 * Models sometimes mangle a path they copy (an extra underscore, a changed case). A missing file
 * resolves to the one supported file in the same folder whose name matches loosely; otherwise the
 * error lists what the folder has.
 */
async function resolveResumePath(full: string): Promise<{ path: string; requestedPath?: string }> {
  if (await exists(full)) return { path: full };
  const folder = dirname(full);
  const files = await readdir(folder).catch(() => {
    throw new Error(`No such file or folder: ${full}`);
  });
  const resumes = files.filter((file) => isFormatExt(extname(file).toLowerCase()));
  const matches = resumes.filter((file) => looseName(file) === looseName(basename(full)));
  const [only] = matches;
  if (only !== undefined && matches.length === 1)
    return { path: join(folder, only), requestedPath: full };
  const listed = resumes.length > 0 ? resumes.join(", ") : "no .pdf, .md or .txt files";
  throw new Error(`No such file: ${full}. Files in that folder: ${listed}`);
}

const expandHome = (path: string): string =>
  path.startsWith("~/") ? `${homedir()}${path.slice(1)}` : path;

/** Reads a resume from disk: PDF, Markdown or plain text. */
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
