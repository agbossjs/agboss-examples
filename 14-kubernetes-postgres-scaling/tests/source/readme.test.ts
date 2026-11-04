/**
 * agbossjs/agboss#487 AC4 — the README walks the cycle in order, gives the commands, and links the
 * guarantees and the pages they rest on; every file it links exists.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const README = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
const WIKI = "https://github.com/agbossjs/agboss/wiki/";

describe("AC4: the README", () => {
  it("walks backlog → scale-out → distributed execution → failure → recovery → scale-in → verification, in order", () => {
    const steps = ["**Backlog.**", "**Scale-out.**", "**Distributed execution.**", "**A worker killed mid-run.**", "**The dead and risen worker**", "**Scale-in.**", "**Verification.**"];
    const positions = steps.map((step) => README.indexOf(step));
    expect(positions.every((position) => position > 0)).toBe(true);
    expect([...positions].sort((left, right) => left - right)).toEqual(positions);
  });

  it("gives the commands", () => {
    for (const command of ["npm run cluster:up", "npm run cluster:scenario", "npm run cluster:down", "npm test", "npm run demo"])
      expect(README).toContain(command);
  });

  it("links the guarantees and the pages they rest on", () => {
    for (const page of ["Guarantees", "Several-instances", "Running-on-PostgreSQL", "Metrics", "Autoscaling", "Deploying-on-Kubernetes"])
      expect(README).toContain(`${WIKI}${page}`);
  });

  it("every local file it links exists, and the recorded run is filled in", () => {
    const links = [...README.matchAll(/\]\(\.\/([^)#]+)\)/gu)].map((match) => match[1] ?? "");
    expect(links.length).toBeGreaterThan(10);
    for (const link of links) expect(existsSync(new URL(`../../${link}`, import.meta.url)), link).toBe(true);
    expect(README).not.toContain("RECORDED_RUN");
  });
});
