/**
 * agbossjs/agboss#487 AC2, AC3, AC5 — the verification classifies every protected write from public
 * evidence alone, and it bites: hand-built evidence of a clean run passes; a second delivery, a
 * second ledger entry, a child that ended twice, a refusal with no takeover, a replay of a token
 * nobody wrote, a failed ledger call, a missing record and a missing expected refusal each fail it,
 * naming the job; so does a write applied or replayed at a token below the lease's latest epoch, on
 * its own (a zombie a store let through). agbossjs/agboss#763: a job planned to fail passes only at its failure finish with
 * nothing delivered or entered, and the batch's output counts it.
 */
import {
  ChildExecutionStatus,
  ExecutionHistoryStatus,
  ExecutionAuditEventKind,
  FencedEffectEventOutcome,
  LeaseTakeoverReason,
  OutboundCallStatus,
  type ExecutionHistoryRecord,
  type ExecutionAuditEventRecord,
  type OutboundCallRecord,
} from "@agboss/core";
import { describe, expect, it } from "vitest";
import type { StubState } from "../../src/stub/ledger-stub.js";
import { verifyRun, WriteVerdict, type BatchEvidence, type Expectation } from "../../src/verification/verify.js";

const BASE = { tenantId: "default", rootExecutionId: "root-1", occurredAt: "2026-11-02T10:00:00.000Z" };
const exec = (jobId: string): string => `child-${jobId}`;

const deliver = (
  jobId: string,
  instance: string,
  token: number,
  outcome: FencedEffectEventOutcome,
  extra: Record<string, number> = {},
): ExecutionAuditEventRecord =>
  ({
    ...BASE,
    kind: ExecutionAuditEventKind.FencedEffect,
    executionId: exec(jobId),
    scopeKey: `default:${exec(jobId)}`,
    token,
    holderInstanceId: instance,
    name: "deliver",
    outcome,
    step: { nodeId: "process-job-action", visitNumber: 1, idempotencyKey: `k-${jobId}` },
    ...extra,
  });

const takeover = (jobId: string, by: string, token: number, from: string, previousToken: number): ExecutionAuditEventRecord =>
  ({
    ...BASE,
    kind: ExecutionAuditEventKind.Takeover,
    executionId: exec(jobId),
    scopeKey: `default:${exec(jobId)}`,
    token,
    holderInstanceId: by,
    reason: LeaseTakeoverReason.RemoteChild,
    previousHolderInstanceId: from,
    previousToken,
  });

const call = (jobId: string, status = OutboundCallStatus.Completed): OutboundCallRecord =>
  ({ executionId: exec(jobId), name: "ledger", status }) as OutboundCallRecord;

const child = (jobId: string, status = ChildExecutionStatus.Finished, finish = "job-done-workflow-finish") => ({
  executionId: exec(jobId),
  status,
  input: { jobId, durationMs: 0 },
  ...(status === ChildExecutionStatus.Finished ? { finish: { name: finish } } : {}),
});

function batchOf(
  jobIds: readonly string[],
  events: readonly ExecutionAuditEventRecord[],
  overrides: {
    children?: unknown[];
    calls?: OutboundCallRecord[];
    record?: "missing";
    failedJobIds?: string[];
    output?: Record<string, number>;
  } = {},
): BatchEvidence {
  const failed = overrides.failedJobIds ?? [];
  const record = {
    status: ExecutionHistoryStatus.Finished,
    rootExecutionId: "root-1",
    output: overrides.output ?? { jobs: jobIds.length, succeeded: jobIds.length - failed.length, failed: failed.length, workers: 2 },
    children: overrides.children ?? jobIds.map((jobId) => child(jobId)),
  } as unknown as ExecutionHistoryRecord;
  return {
    batchId: "b",
    jobIds,
    failedJobIds: failed,
    record: overrides.record === "missing" ? undefined : record,
    auditLog: events,
    outboundCalls: overrides.calls ?? jobIds.map((jobId) => call(jobId)),
  };
}

const stubOf = (jobIds: readonly string[], extra: readonly string[] = [], rejected: readonly string[] = []): StubState => ({
  work: rejected.map((jobId, index) => ({
    callId: index + 1,
    jobId,
    executionId: exec(jobId),
    rootExecutionId: "root-1",
    instanceId: "a",
    pod: "pod-a",
    token: 1,
    receivedAt: BASE.occurredAt,
    answeredAt: BASE.occurredAt,
    held: false,
    rejected: true,
  })),
  ledgerRequests: [],
  entries: [...jobIds, ...extra].map((jobId, index) => ({
    entryId: `e-${String(index)}`,
    jobId,
    idempotencyKey: `key-${jobId}-${String(index)}`,
    deliveredBy: "a",
    appliedAt: BASE.occurredAt,
  })),
});

const JOBS = ["j1", "j2", "z", "k", "r"];
/** The dead-and-risen run: z's zombie refused, k's killed holder never wrote, r replayed. */
const DEAD_AND_RISEN: ExecutionAuditEventRecord[] = [
  deliver("j1", "a", 1, FencedEffectEventOutcome.Ran),
  deliver("j2", "b", 1, FencedEffectEventOutcome.Ran),
  takeover("z", "b", 2, "zombie", 1),
  deliver("z", "b", 2, FencedEffectEventOutcome.Ran),
  deliver("z", "zombie", 1, FencedEffectEventOutcome.Refused, { observedToken: 2 }),
  takeover("k", "a", 2, "killed", 1),
  deliver("k", "a", 2, FencedEffectEventOutcome.Ran),
  deliver("r", "crashed", 1, FencedEffectEventOutcome.Ran),
  takeover("r", "b", 2, "crashed", 1),
  deliver("r", "b", 2, FencedEffectEventOutcome.Replayed, { writtenToken: 1 }),
];
const EXPECTED: Expectation[] = [
  { batchId: "b", jobId: "z", kind: "refused", instanceId: "zombie", why: "the frozen pod came back" },
  { batchId: "b", jobId: "k", kind: "never-attempted", instanceId: "killed", why: "killed before its write" },
  { batchId: "b", jobId: "r", kind: "replayed", why: "crashed after its write" },
];

describe("AC3 + AC5: a clean run passes, every write classified", () => {
  it("the dead-and-risen run: refused, never attempted, replayed — and every job exactly once", () => {
    const report = verifyRun({ batches: [batchOf(JOBS, DEAD_AND_RISEN)], stub: stubOf(JOBS), expectations: EXPECTED });

    expect(report.passed).toBe(true);
    expect(report.expectations.every((one) => one.found)).toBe(true);
    expect(report.totals).toMatchObject({ jobs: 5, duplicates: 0, accepted: 5, refused: 1, "never-attempted": 1, replayed: 1, inconsistent: 0 });
    const verdicts = (jobId: string) => report.jobs.find((job) => job.jobId === jobId)?.attempts.map((one) => [one.instanceId, one.verdict]);
    expect(verdicts("z")).toEqual([["b", WriteVerdict.Accepted], ["zombie", WriteVerdict.Refused]]);
    expect(verdicts("k")).toEqual([["a", WriteVerdict.Accepted], ["killed", WriteVerdict.NeverAttempted]]);
    expect(verdicts("r")).toEqual([["crashed", WriteVerdict.Accepted], ["b", WriteVerdict.Replayed]]);
  });
});

describe("AC3 + AC5: the verification bites", () => {
  const fails = (batch: BatchEvidence, stub: StubState, expectations: Expectation[] = []) => {
    const report = verifyRun({ batches: [batch], stub, expectations });
    expect(report.passed).toBe(false);
    return report;
  };
  const problemsOf = (report: ReturnType<typeof verifyRun>, jobId: string) =>
    report.jobs.find((job) => job.jobId === jobId)?.problems.join("; ") ?? "";

  it("a second delivery of a job (two Ran) fails, naming the job", () => {
    const report = fails(batchOf(JOBS, [...DEAD_AND_RISEN, deliver("j1", "b", 2, FencedEffectEventOutcome.Ran)]), stubOf(JOBS));
    expect(problemsOf(report, "j1")).toContain("2 deliveries ran");
    expect(report.totals.duplicates).toBe(1);
  });

  it("a second ledger entry at the other system fails", () => {
    const report = fails(batchOf(JOBS, DEAD_AND_RISEN), stubOf(JOBS, ["r"]));
    expect(problemsOf(report, "r")).toContain("2 ledger entries applied");
  });

  it("a child that ended twice fails", () => {
    const report = fails(batchOf(JOBS, DEAD_AND_RISEN, { children: [...JOBS.map((jobId) => child(jobId)), child("j2")] }), stubOf(JOBS));
    expect(problemsOf(report, "j2")).toContain("2 child executions ended");
  });

  it("a child that failed fails", () => {
    const children = JOBS.map((jobId) => child(jobId, jobId === "j1" ? ChildExecutionStatus.Failed : ChildExecutionStatus.Finished));
    expect(problemsOf(fails(batchOf(JOBS, DEAD_AND_RISEN, { children }), stubOf(JOBS)), "j1")).toContain("ended failed");
  });

  it("a refusal with no takeover by a newer holder is inconsistent", () => {
    const events = [...DEAD_AND_RISEN, deliver("j2", "c", 1, FencedEffectEventOutcome.Refused, { observedToken: 1 })];
    expect(problemsOf(fails(batchOf(JOBS, events), stubOf(JOBS)), "j2")).toContain("inconsistent");
  });

  it("a replay of a token no Ran wrote is inconsistent", () => {
    const events = DEAD_AND_RISEN.map((event) =>
      event.kind === ExecutionAuditEventKind.FencedEffect && event.outcome === FencedEffectEventOutcome.Replayed ? { ...event, writtenToken: 7 } : event,
    );
    expect(problemsOf(fails(batchOf(JOBS, events), stubOf(JOBS)), "r")).toContain("which no Ran wrote");
  });

  it("a ledger call left pending fails", () => {
    const calls = JOBS.map((jobId) => call(jobId, jobId === "k" ? OutboundCallStatus.Pending : OutboundCallStatus.Completed));
    expect(problemsOf(fails(batchOf(JOBS, DEAD_AND_RISEN, { calls }), stubOf(JOBS)), "k")).toContain("pending");
  });

  it("a batch with no kept record fails", () => {
    const report = fails(batchOf(JOBS, DEAD_AND_RISEN, { record: "missing" }), stubOf(JOBS));
    expect(report.batches[0]?.problems).toContain("no execution record kept for the batch");
  });

  it("a clean result with the zombie's refusal missing fails: a clean final result alone never passes", () => {
    const events = DEAD_AND_RISEN.filter((event) => !(event.kind === ExecutionAuditEventKind.FencedEffect && event.outcome === FencedEffectEventOutcome.Refused));
    const report = fails(batchOf(JOBS, events), stubOf(JOBS), EXPECTED);
    expect(report.jobs.every((job) => job.problems.length === 0)).toBe(true);
    expect(report.expectations.find((one) => one.jobId === "z")?.found).toBe(false);
  });

  it("a killed holder that is counted as refused is not 'never attempted'", () => {
    const events = [...DEAD_AND_RISEN, deliver("k", "killed", 1, FencedEffectEventOutcome.Refused, { observedToken: 2 })];
    const report = fails(batchOf(JOBS, events), stubOf(JOBS), EXPECTED);
    expect(report.expectations.find((one) => one.jobId === "k")?.found).toBe(false);
  });
});

describe("agbossjs/agboss#763: a failed job ends at its own failure finish, the batch goes on", () => {
  // f was rejected by the other system: it ended at its failure finish, nothing delivered or entered
  const WITH_FAILED = [...JOBS, "f"];
  const children = () => [...JOBS.map((jobId) => child(jobId)), child("f", ChildExecutionStatus.Finished, "job-failed-workflow-finish")];
  const calls = () => JOBS.map((jobId) => call(jobId));
  const failedBatch = (overrides: Parameters<typeof batchOf>[2] = {}) =>
    batchOf(WITH_FAILED, DEAD_AND_RISEN, { children: children(), calls: calls(), failedJobIds: ["f"], ...overrides });

  it("the batch with one failed job passes: five done once, one failed, counted in its output", () => {
    const report = verifyRun({ batches: [failedBatch()], stub: stubOf(JOBS, [], ["f"]), expectations: EXPECTED });

    expect(report.jobs.flatMap((job) => job.problems)).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.totals).toMatchObject({ jobs: 6, failed: 1, accepted: 5, duplicates: 0 });
  });

  it("a failed job whose child finished at the done finish fails", () => {
    const report = verifyRun({
      batches: [failedBatch({ children: [...JOBS.map((jobId) => child(jobId)), child("f")] })],
      stub: stubOf(JOBS, [], ["f"]),
      expectations: [],
    });
    expect(report.passed).toBe(false);
    expect(report.jobs.find((job) => job.jobId === "f")?.problems.join("; ")).toContain("expected job-failed-workflow-finish");
  });

  it("a failed job with a ledger entry, or never rejected by the other system, fails", () => {
    const entered = verifyRun({ batches: [failedBatch()], stub: stubOf(JOBS, ["f"], ["f"]), expectations: [] });
    expect(entered.jobs.find((job) => job.jobId === "f")?.problems.join("; ")).toContain("1 ledger entries applied (expected exactly 0)");
    const neverRejected = verifyRun({ batches: [failedBatch()], stub: stubOf(JOBS), expectations: [] });
    expect(neverRejected.jobs.find((job) => job.jobId === "f")?.problems.join("; ")).toContain("never rejected");
  });

  it("a job done where one was planned to fail fails: it ended at the failure finish of no plan", () => {
    const report = verifyRun({
      batches: [batchOf(JOBS, DEAD_AND_RISEN, { children: [...JOBS.slice(1).map((jobId) => child(jobId)), child("j1", ChildExecutionStatus.Finished, "job-failed-workflow-finish")] })],
      stub: stubOf(JOBS),
      expectations: [],
    });
    expect(report.jobs.find((job) => job.jobId === "j1")?.problems.join("; ")).toContain("expected job-done-workflow-finish");
  });

  it("a batch whose output does not count its failed job fails", () => {
    const report = verifyRun({
      batches: [failedBatch({ output: { jobs: 6, succeeded: 6, failed: 0, workers: 2 } })],
      stub: stubOf(JOBS, [], ["f"]),
      expectations: [],
    });
    expect(report.batches[0]?.problems.join("; ")).toContain("expected 5 and 1");
  });

  it("a failed job that cancelled its batch fails", () => {
    const record = { ...failedBatch().record, status: ExecutionHistoryStatus.Cancelled } as ExecutionHistoryRecord;
    const report = verifyRun({ batches: [{ ...failedBatch(), record }], stub: stubOf(JOBS, [], ["f"]), expectations: [] });
    expect(report.batches[0]?.problems.join("; ")).toContain("the batch ended cancelled");
  });
});

describe("the verification stands alone: no effect applied or replayed at a stale token", () => {
  const STALE = ["s"];
  const verifyStale = (events: ExecutionAuditEventRecord[]) =>
    verifyRun({ batches: [batchOf(STALE, events)], stub: stubOf(STALE), expectations: [] });

  it("a zombie's replay at its stale token, after the lease was taken over at a newer one, fails", () => {
    const report = verifyStale([
      takeover("s", "a", 2, "zombie", 1),
      deliver("s", "a", 2, FencedEffectEventOutcome.Ran),
      // the zombie, back at token 1, got the stored receipt: a store that read the key at a stale token
      deliver("s", "zombie", 1, FencedEffectEventOutcome.Replayed, { writtenToken: 2 }),
    ]);

    expect(report.passed).toBe(false);
    const job = report.jobs.find((one) => one.jobId === "s");
    expect(job?.attempts.find((one) => one.instanceId === "zombie")?.verdict).toBe(WriteVerdict.Inconsistent);
    expect(job?.problems.join("; ")).toContain("stale token 1");
  });

  it("a zombie's write at its stale token, replayed by the new holder, fails: one Ran is not enough", () => {
    const report = verifyStale([
      takeover("s", "a", 2, "zombie", 1),
      deliver("s", "zombie", 1, FencedEffectEventOutcome.Ran),
      deliver("s", "a", 2, FencedEffectEventOutcome.Replayed, { writtenToken: 1 }),
    ]);

    expect(report.passed).toBe(false);
    expect(report.jobs.find((one) => one.jobId === "s")?.problems.join("; ")).toContain("stale token 1");
  });

  it("a write at token 1 before the takeover at 2, replayed after it, is no stale write (the crash after the effect)", () => {
    const report = verifyStale([
      deliver("s", "crashed", 1, FencedEffectEventOutcome.Ran),
      takeover("s", "b", 2, "crashed", 1),
      deliver("s", "b", 2, FencedEffectEventOutcome.Replayed, { writtenToken: 1 }),
    ]);

    expect(report.jobs.flatMap((one) => one.problems)).toEqual([]);
    expect(report.passed).toBe(true);
  });
});
