import { describe, expect, it } from "vitest";
import { runFederationBlastRadiusProof } from "../federation/verify-federation.js";

describe("Enterprise Agent Mesh — Federation Contract Check & Blast Radius (EX-17)", () => {
  it("passes compatible snapshots, detects incompatible schema + missing target with blast radius, and stitches hub show", async () => {
    const result = await runFederationBlastRadiusProof();

    expect(result.compatibleOk).toBe(true);
    expect(result.breakingExitCode).not.toBe(0);
    expect(result.breakingCodes).toContain("federation.incompatible-schema");
    expect(result.breakingCodes).toContain("federation.missing-target");
    expect(result.blastRadiusWorkflows).toContain(
      "triage-gateway-application › triage-workflow",
    );
    expect(result.hubAppNames).toEqual(
      expect.arrayContaining([
        "triage-gateway-application",
        "billing-application",
        "catalog-application",
      ]),
    );
  });
});
