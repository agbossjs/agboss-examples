import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SCENARIOS } from "../scenarios/index.js";

const readme = readFileSync(join(import.meta.dirname, "..", "README.md"), "utf8");
/** The README's prose as one line: quotes unwrapped, lines joined. */
const prose = readme.replaceAll(/^> ?/gmu, "").replaceAll(/\s+/gu, " ");

/** AC4: a paragraph per scenario, the Wiki links, the notice. */
describe("README", () => {
  it("a paragraph per scenario, each linking its scenario on the Wiki", () => {
    for (const scenario of SCENARIOS) {
      const id = scenario.id.toUpperCase();
      const paragraph = new RegExp(`^- \\*\\*${id} — [^\\n]+\\n(?:  [^\\n]+\\n)+`, "mu").exec(readme)?.[0] ?? "";
      expect(paragraph, id).toContain(`https://github.com/agbossjs/agboss/wiki/Payment-scenarios#${scenario.id}-`);
      expect(paragraph, id).toMatch(/\bright\b/iu);
    }
  });

  it("links the three Payments pages of the Wiki", () => {
    for (const page of ["Payments", "Payment-scenarios", "Payment-gateways"])
      expect(readme).toContain(`https://github.com/agbossjs/agboss/wiki/${page})`);
  });

  it("carries the notice: independent, not affiliated, the stub fictional", () => {
    expect(prose).toContain("**Independent example, not affiliated.**");
    expect(prose).toContain("it imitates no real gateway's API or name, and no real gateway is ever called");
    expect(prose).toContain("check the official documentation before relying on anything here");
  });

  it("names the unknown-outcome and key-retention guarantees with their tickets", () => {
    for (const ticket of ["#657", "#658"]) expect(readme).toContain(`https://github.com/agbossjs/agboss/issues/${ticket.slice(1)}`);
  });
});
