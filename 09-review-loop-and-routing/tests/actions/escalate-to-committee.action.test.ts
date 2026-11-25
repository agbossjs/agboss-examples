import { testUnit } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { EscalateToCommitteeAction } from "../../src/actions/escalate-to-committee.action.js";
import { SOUND_APPLICATION } from "../support/applications.js";

describe("EscalateToCommitteeAction — code, no model", () => {
  it("hands the committee the applicant, the last memo, its limit and the open request", async () => {
    const escalate = testUnit(EscalateToCommitteeAction);

    const run = await escalate({
      application: SOUND_APPLICATION,
      memo: { text: "v4: Dana Levi, kitchen, DTI 0.28", recommendedLimitUsd: 35_000 },
      changes: { notes: "still no collateral" },
    });

    expect(run.output).toEqual({
      applicantName: "Dana Levi",
      lastMemo: "v4: Dana Levi, kitchen, DTI 0.28",
      openRequest: "still no collateral",
      recommendedLimitUsd: 35_000,
    });
    expect(run.spend.calls).toBe(0);
  });
});
