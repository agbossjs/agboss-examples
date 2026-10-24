import {
  BranchVerdict,
  ExecutionStatus,
  PauseResolution,
} from "agboss";
import { describe, expect, it } from "vitest";
import { runPauseWithdrawalScenario } from "../scenarios/pause-withdrawal.js";
import { runQuorumApprovalScenario } from "../scenarios/quorum-approval.js";

describe("travel-booking-saga — 2-of-3 Quorum & HITL Pause Withdrawal Proofs (Scenarios E & F)", () => {
  it("Scenario E: achieves 2-of-3 parallel reviewer quorum via BookingQuorumArbiter even when 3rd reviewer rejects", async () => {
    const res = await runQuorumApprovalScenario("QUORUM-E1");

    expect(res.status).toBe(ExecutionStatus.Finished);
    expect(res.outcomeStatus).toBe("CONFIRMED_BY_QUORUM");
    expect(res.summary).toContain("Quorum achieved (2/3)");
    expect(res.summary).toContain("finance");
    expect(res.summary).toContain("compliance");

    const accepted = res.branches.filter((b) => b.verdict === BranchVerdict.Counted);
    expect(accepted.length).toBe(2);
  });

  it("Scenario F: automatically calls Channel.withdraw(Withdrawn) when 2-of-3 quorum supersedes a paused 3rd branch", async () => {
    const res = await runPauseWithdrawalScenario("WITHDRAW-F1");

    expect(res.status).toBe(ExecutionStatus.Finished);
    expect(res.outcomeStatus).toBe("CONFIRMED_BY_QUORUM");
    expect(res.sentPauseId).not.toBe("");
    expect(res.withdrawnPauseId).toBe(res.sentPauseId);
    expect(res.withdrawnResolution).toBe(PauseResolution.Withdrawn);
    expect(res.lateResumeRejectedWithNotPaused).toBe(true);
  });
});
