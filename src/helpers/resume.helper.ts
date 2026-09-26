import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, extname, join } from "node:path";
import { extractText, getDocumentProxy } from "unpdf";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** The model gets at most this much resume text. */
export const MAX_RESUME_CHARS = 20_000;

export type PdfExtractor = (bytes: Uint8Array) => Promise<string>;

export const extractPdf: PdfExtractor = async (bytes) => {
  const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true });
  return text;
};

export const FORMATS = { ".pdf": "pdf", ".md": "markdown", ".txt": "text" } as const;
export type Format = (typeof FORMATS)[keyof typeof FORMATS];

export const isFormatExt = (ext: string): ext is keyof typeof FORMATS => ext in FORMATS;

export interface Resume {
  readonly path: string;
  /** The path that was asked for, when it did not exist and a near match was read instead. */
  readonly requestedPath?: string;
  readonly format: Format;
  readonly text: string;
  readonly truncated: boolean;
}

/** Name for near-match comparison: case, underscores, spaces and dashes do not matter. */
export const looseName = (name: string): string => name.toLowerCase().replace(/[\s_-]+/g, "");

export const exists = async (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  );

/**
 * Models sometimes mangle a path they copy (an extra underscore, a changed case). A missing file
 * resolves to the one supported file in the same folder whose name matches loosely; otherwise the
 * error lists what the folder has.
 */
export async function resolveResumePath(
  full: string,
): Promise<{ path: string; requestedPath?: string }> {
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

export const expandHome = (path: string): string =>
  path.startsWith("~/") ? `${homedir()}${path.slice(1)}` : path;

/** Reads a resume from disk: PDF, Markdown or plain text. */
