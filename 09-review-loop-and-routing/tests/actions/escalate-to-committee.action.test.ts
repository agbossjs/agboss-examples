import { testAction } from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import { EscalateToCommitteeAction } from "../../src/actions/escalate-to-committee.action.js";
import { MemoEditorAgent } from "../../src/agents/memo-editor/memo-editor.agent.js";
import { RiskOfficerAgent } from "../../src/agents/risk-officer/risk-officer.agent.js";
import { CodeRoutedCreditWorkflowStart } from "../../src/workflows/credit-review/code-routed-credit.workflow-start.js";
import { SOUND_APPLICATION } from "../support/applications.js";

describe("EscalateToCommitteeAction — code, no model", () => {
  it("hands the committee the applicant, the last memo, its limit and the open request", async () => {
    const escalate = testAction(EscalateToCommitteeAction);

    const run = await escalate({
      application: { producer: CodeRoutedCreditWorkflowStart, value: SOUND_APPLICATION },
      memo: {
        producer: MemoEditorAgent,
        value: { text: "v4: Dana Levi, kitchen, DTI 0.28", recommendedLimitUsd: 35_000 },
      },
      changes: { producer: RiskOfficerAgent, value: { notes: "still no collateral" } },
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
