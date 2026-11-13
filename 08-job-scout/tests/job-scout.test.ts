import { override, testTool } from "@agboss/core/testing";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { htmlToText } from "../src/helpers/boards.helper.js";
import { matchScore } from "../src/helpers/greenhouse.helper.js";
import { MAX_RESUME_CHARS } from "../src/helpers/resume.helper.js";
import { ReadResume } from "../src/tools/read-resume.tool.js";
import { ResumeReader } from "../src/services/resume-reader.service.js";

async function fileWith(name: string, content: string | Uint8Array): Promise<string> {
  const path = join(await mkdtemp(join(tmpdir(), "resume-")), name);
  await writeFile(path, content);
  return path;
}

/** A reader whose PDF extractor answers a long text: no real PDF needed. */
class LongPdfReader extends ResumeReader {
  constructor() {
    super(() => Promise.resolve("x".repeat(MAX_RESUME_CHARS + 5)));
  }
}

const readResume = testTool(ReadResume);

describe("read-resume-tool", () => {
  it("reads Markdown and text", async () => {
    const { output } = await readResume({
      path: await fileWith("cv.md", "# Me\nTypeScript,   Kafka"),
    });

    expect(output).toMatchObject({
      format: "markdown",
      text: "# Me\nTypeScript, Kafka",
      truncated: false,
    });
  });

  it("reads PDF through the extractor and truncates long text", async () => {
    const longPdf = testTool(ReadResume, { overrides: [override(ResumeReader, LongPdfReader)] });

    const { output } = await longPdf({ path: await fileWith("cv.pdf", new Uint8Array([1, 2])) });

    expect(output).toMatchObject({ format: "pdf", truncated: true });
    expect(output.text.length).toBe(MAX_RESUME_CHARS);
  });

  it("reports unsupported formats and missing files to the model", async () => {
    await expect(readResume({ path: await fileWith("cv.docx", "x") })).rejects.toThrow(
      "Unsupported",
    );
    await expect(readResume({ path: "/nope/cv.pdf" })).rejects.toThrow();
  });
});

describe("greenhouse helpers", () => {
  it("turns escaped Greenhouse HTML into text", () => {
    expect(htmlToText("&lt;p&gt;Node.js &amp;amp; &lt;b&gt;Kafka&lt;/b&gt;&lt;/p&gt;")).toBe(
      "Node.js & Kafka",
    );
  });

  it("scores by the share of skills mentioned, as whole words", () => {
    expect(
      matchScore(
        ["TypeScript", "Kafka", "Go", "Java"],
        "We use typescript and Kafka; JavaScript too",
      ),
    ).toEqual({
      score: 50,
      matched: ["TypeScript", "Kafka"],
    });
    expect(matchScore([], "anything").score).toBe(0);
  });
});

describe("read-resume-tool near-miss paths", () => {
  it("reads the one loosely matching file when the model mangled the name", async () => {
    const real = await fileWith("Pavel__Ravvich_CV.md", "# CV\nJava");
    const mangled = real.replace("Pavel__Ravvich_CV.md", "pavel__ravvich__cv.md");

    const { output } = await readResume({ path: mangled });

    expect(output).toMatchObject({ path: real, requestedPath: mangled, text: "# CV\nJava" });
  });

  it("reports the folder's resume files when nothing matches, and a plain error for a missing folder", async () => {
    const real = await fileWith("cv.md", "x");
    await expect(readResume({ path: real.replace("cv.md", "resume.pdf") })).rejects.toThrow(
      "Files in that folder: cv.md",
    );
    await expect(readResume({ path: "/nope/nope/cv.pdf" })).rejects.toThrow(
      "No such file or folder",
    );
  });

  it("does not report a requested path when the exact file exists", async () => {
    const { output } = await readResume({ path: await fileWith("cv.txt", "x") });

    expect("requestedPath" in output).toBe(false);
  });
});
