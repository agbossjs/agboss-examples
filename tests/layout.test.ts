import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = new URL("../src", import.meta.url).pathname;
const files = (folder: string): string[] => readdirSync(join(src, folder));

/** Each folder holds one kind of file, named by its suffix (Angular style). */
const SUFFIXES: Readonly<Record<string, RegExp>> = {
  agents: /\.(agent\.ts|prompt\.md)$/,
  tools: /\.tool(\.test)?\.ts$/,
  services: /\.service\.ts$/,
  mcp: /\.(server|mcp)\.ts$/,
  rag: /\.rag\.ts$/,
  helpers: /\.helper\.ts$/,
};

describe("job-scout follows the file conventions (#107)", () => {
  it("AC3: at the top of src/ only the workflow, the Studio entry and folders by theme", () => {
    expect(readdirSync(src).sort()).toEqual(
      [
        "agents",
        "config",
        "data",
        "helpers",
        "job-scout.workflow.ts",
        "mcp",
        "rag",
        "scripts",
        "services",
        "studio.ts",
        "tools",
      ].sort(),
    );
  });

  it("AC3: every file in a kind folder carries that kind's suffix", () => {
    for (const [folder, suffix] of Object.entries(SUFFIXES)) {
      for (const file of files(folder)) expect(file, `${folder}/${file}`).toMatch(suffix);
    }
  });

  it("AC3: tools keep only the tool — no module-level helper functions", () => {
    for (const file of files("tools").filter((f) => f.endsWith(".tool.ts"))) {
      const text = readFileSync(join(src, "tools", file), "utf8");
      expect(text, file).not.toMatch(/^(export )?(async )?function /m);
      expect(text, file).not.toMatch(/^(export )?const [a-z]\w* = (async )?\(/m);
    }
  });
});
