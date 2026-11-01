import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const gateways = join(import.meta.dirname, "..", "src", "gateways");

/** The lines of code: no blank line, no comment line. */
const codeLines = (text: string): number =>
  text.split("\n").filter((line) => line.trim() !== "" && !/^\s*(\/\/|\/\*|\*)/u.test(line)).length;

describe("the wiring stays a page a developer can copy", () => {
  for (const slug of readdirSync(gateways)) {
    const text = readFileSync(join(gateways, slug, `${slug}.gateway-payments.ts`), "utf8");
    it(`${slug}: each wiring file is at most 70 lines, and starts with the notice`, () => {
      expect(codeLines(text)).toBeLessThanOrEqual(70);
      expect(text.split("\n")[0]).toMatch(/^\/\/ Independent example, not affiliated\./u);
      expect(text).toContain("as read on 2026-11-01");
    });
  }
});
