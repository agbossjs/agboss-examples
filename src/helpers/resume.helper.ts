import { homedir } from "node:os";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** The model gets at most this much resume text. */
export const MAX_RESUME_CHARS = 20_000;

export type PdfExtractor = (bytes: Uint8Array) => Promise<string>;

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

export const expandHome = (path: string): string =>
  path.startsWith("~/") ? `${homedir()}${path.slice(1)}` : path;

/** Whitespace collapsed, cut to what the model may read. */
export function resumeText(raw: string): { text: string; truncated: boolean } {
  const text = raw.replace(/[ \t]+/g, " ").trim();
  return { text: text.slice(0, MAX_RESUME_CHARS), truncated: text.length > MAX_RESUME_CHARS };
}
