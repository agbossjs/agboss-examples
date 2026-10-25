import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PROJECTS, parseRunAllArgs, selectProjects } from "./run-all.mjs";

describe("run-all.mjs P0/P1 & --project selection contract (Section 4.3)", () => {
  it("selects only P0 projects by default when --include-p1 is omitted", () => {
    const selected = selectProjects(["--mode", "check"]);
    assert.deepEqual(
      selected.map((p) => p.name),
      [
        "01-hello-agboss",
        "02-path-scope-proof",
        "03-support-refund-desk",
        "04-travel-booking-saga",
        "07-langgraph-migration",
      ],
    );
    assert.equal(
      selected.every((p) => p.priority === "P0"),
      true,
    );
  });

  it("selects both P0 and P1 projects when --include-p1 is passed", () => {
    const selected = selectProjects(["--include-p1", "--mode", "test"]);
    assert.equal(selected.length, 7);
    assert.deepEqual(
      selected.map((p) => p.name),
      PROJECTS.map((p) => p.name),
    );
  });

  it("selects a single specified project via --project even when it is P1", () => {
    const selectedP1 = selectProjects(["--project", "05-cluster-work-stealing", "--mode", "demo"]);
    assert.deepEqual(
      selectedP1.map((p) => p.name),
      ["05-cluster-work-stealing"],
    );

    const selectedP0 = selectProjects(["--project", "02-path-scope-proof"]);
    assert.deepEqual(
      selectedP0.map((p) => p.name),
      ["02-path-scope-proof"],
    );
  });

  it("parses mode, includeP1, projectFilter, and resetState flags accurately", () => {
    assert.deepEqual(parseRunAllArgs([]), {
      mode: "test",
      includeP1: false,
      projectFilter: undefined,
      resetState: false,
    });
    assert.deepEqual(
      parseRunAllArgs(["--mode", "demo", "--include-p1", "--project", "06-enterprise-agent-mesh", "--reset"]),
      {
        mode: "demo",
        includeP1: true,
        projectFilter: "06-enterprise-agent-mesh",
        resetState: true,
      },
    );
  });
});
