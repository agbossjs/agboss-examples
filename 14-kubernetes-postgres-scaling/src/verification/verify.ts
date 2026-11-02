// The verification of a run (agbossjs/agboss#487), from public evidence only: the batches' kept
// execution records (`ExecutionHistoryRecord`), their trees' lease log (`app.leaseEventsOf`) and
// outbound calls (`app.outboundCallsOf`), and the other system's own state (the stub). Never the
// console, never the core's tables. A clean final result alone never passes: every protected write
// attempt is classified, and the scenario's expected classifications must be found.
import {
  ChildExecutionStatus,
  ExecutionHistoryStatus,
  ExecutionLeaseEventKind,
  FencedEffectEventOutcome,
  OutboundCallStatus,
  type ExecutionHistoryRecord,
  type ExecutionLeaseEventRecord,
  type FencedEffectRecord,
  type LeaseTakeoverRecord,
  type OutboundCallRecord,
} from "@agboss/core";
import type { StubState } from "../stub/ledger-stub.js";

/** The protected write of a job (the fenced effect's name in `ProcessJobAction`). */
export const DELIVER = "deliver";
/** The job's call that leaves the system. */
export const LEDGER = "ledger";

/** How one attempt at a job's protected write ended, as the evidence shows it. */
export enum WriteVerdict {
  /** The write ran under the holder's current lease (`Ran`, or `Joined` it). */
  Accepted = "accepted",
  /** A later holder got the stored result back (`Replayed`): the write did not run again. */
  Replayed = "replayed",
  /** A holder whose lease was taken over reached the write and was refused (`ExecutionFencedError`). */
  Refused = "refused",
  /** A holder whose lease was taken over never reached the write (it was killed, or stopped first). */
  NeverAttempted = "never-attempted",
  /** The evidence does not fit any of these: a failure of the run. */
  Inconsistent = "inconsistent",
}

/** One holder's attempt at a job's write. */
export interface WriteAttempt {
  readonly instanceId: string;
  readonly token: number;
  readonly verdict: WriteVerdict;
  readonly detail: string;
}

/** What the evidence says of one job. */
export interface JobVerification {
  readonly batchId: string;
  readonly jobId: string;
  readonly childExecutions: number;
  readonly deliveries: number;
  readonly ledgerEntries: number;
  readonly ledgerRequests: number;
  readonly outboundCalls: readonly string[];
  readonly attempts: readonly WriteAttempt[];
  readonly problems: readonly string[];
}

/** One batch's evidence, as read from the coordinator. */
export interface BatchEvidence {
  readonly batchId: string;
  /** The job ids the batch was submitted with (the scenario's plan). */
  readonly jobIds: readonly string[];
  readonly record: ExecutionHistoryRecord | undefined;
  readonly leaseEvents: readonly ExecutionLeaseEventRecord[];
  readonly outboundCalls: readonly OutboundCallRecord[];
}

/** A classification the scenario caused on purpose and the report must show. */
export interface Expectation {
  readonly batchId: string;
  /** A job's attempt (`refused`, `never-attempted`, `replayed`), or any job of the batch (`accepted-by`). */
  readonly jobId?: string;
  readonly kind: "refused" | "never-attempted" | "replayed" | "accepted-by";
  /** The instance whose attempt it is (required for `accepted-by`). */
  readonly instanceId?: string;
  readonly why: string;
}

export interface ExpectationResult extends Expectation {
  readonly found: boolean;
}

export interface VerificationReport {
  readonly passed: boolean;
  readonly batches: readonly {
    readonly batchId: string;
    readonly status: string;
    readonly jobs: number;
    readonly problems: readonly string[];
  }[];
  readonly jobs: readonly JobVerification[];
  readonly expectations: readonly ExpectationResult[];
  readonly totals: Readonly<Record<WriteVerdict, number>> & {
    readonly jobs: number;
    readonly duplicates: number;
  };
}

/** The job a child execution ran, from its recorded start input. */
const jobIdOf = (input: unknown): string | undefined => {
  const value = (input ?? {}) as Record<string, unknown>;
  const job = (value["job"] ?? value) as Record<string, unknown>;
  return typeof job["jobId"] === "string" ? job["jobId"] : undefined;
};

const isDeliver = (event: ExecutionLeaseEventRecord): event is FencedEffectRecord =>
  event.kind === ExecutionLeaseEventKind.FencedEffect && event.name === DELIVER;

const isTakeover = (event: ExecutionLeaseEventRecord): event is LeaseTakeoverRecord =>
  event.kind === ExecutionLeaseEventKind.Takeover;

/** Every attempt at the job's write: one per `deliver` event, one per holder taken over without one. */
function attemptsOf(deliveries: readonly FencedEffectRecord[], takeovers: readonly LeaseTakeoverRecord[]): WriteAttempt[] {
  const ran = deliveries.filter((event) => event.outcome === FencedEffectEventOutcome.Ran);
  const attempts = deliveries.map((event): WriteAttempt => {
    const at = { instanceId: event.holderInstanceId, token: event.token };
    switch (event.outcome) {
      case FencedEffectEventOutcome.Ran:
      case FencedEffectEventOutcome.Joined:
        return { ...at, verdict: WriteVerdict.Accepted, detail: `${event.outcome} at token ${String(event.token)}` };
      case FencedEffectEventOutcome.Replayed: {
        const written = ran.find((one) => one.token === event.writtenToken);
        return written === undefined
          ? { ...at, verdict: WriteVerdict.Inconsistent, detail: `replayed token ${String(event.writtenToken)}, which no Ran wrote` }
          : { ...at, verdict: WriteVerdict.Replayed, detail: `replayed what token ${String(written.token)} wrote` };
      }
      case FencedEffectEventOutcome.Refused: {
        const newer = (event.observedToken ?? 0) > event.token;
        const takenOver = takeovers.some((takeover) => takeover.token > event.token);
        return newer && takenOver
          ? { ...at, verdict: WriteVerdict.Refused, detail: `refused at token ${String(event.token)}: the store saw ${String(event.observedToken)}` }
          : { ...at, verdict: WriteVerdict.Inconsistent, detail: `refused at token ${String(event.token)} with no newer holder taking the lease over` };
      }
    }
  });
  for (const takeover of takeovers) {
    const { previousHolderInstanceId: holder, previousToken: token } = takeover;
    if (holder === undefined || token === undefined) continue;
    const ownAttempt = deliveries.some((event) => event.holderInstanceId === holder && event.token === token);
    if (!ownAttempt)
      attempts.push({
        instanceId: holder,
        token,
        verdict: WriteVerdict.NeverAttempted,
        detail: `taken over at token ${String(takeover.token)} by ${takeover.holderInstanceId}; no write of its own at token ${String(token)}`,
      });
  }
  return attempts;
}

/** One job of a batch, checked: done once, written once, entered in the ledger once. */
function verifyJob(batch: BatchEvidence, jobId: string, stub: StubState): JobVerification {
  const problems: string[] = [];
  const children = (batch.record?.children ?? []).filter((child) => jobIdOf(child.input) === jobId);
  if (children.length !== 1) problems.push(`${String(children.length)} child executions ended (expected exactly 1)`);
  for (const child of children)
    if (child.status !== ChildExecutionStatus.Finished) problems.push(`its child ${child.executionId} ended ${child.status}`);
  const executions = new Set(children.map((child) => child.executionId));
  const events = batch.leaseEvents.filter((event) => executions.has(event.executionId));
  const deliveries = events.filter(isDeliver);
  const takeovers = events.filter(isTakeover);
  const attempts = attemptsOf(deliveries, takeovers);
  const ran = deliveries.filter((event) => event.outcome === FencedEffectEventOutcome.Ran).length;
  if (ran !== 1) problems.push(`${String(ran)} deliveries ran (expected exactly 1)`);
  for (const attempt of attempts)
    if (attempt.verdict === WriteVerdict.Inconsistent) problems.push(`inconsistent evidence: ${attempt.detail}`);
  const entries = stub.entries.filter((entry) => entry.jobId === jobId).length;
  if (entries !== 1) problems.push(`${String(entries)} ledger entries applied (expected exactly 1)`);
  const calls = batch.outboundCalls.filter((call) => executions.has(call.executionId) && call.name === LEDGER);
  if (calls.length !== 1 || calls[0]?.status !== OutboundCallStatus.Completed)
    problems.push(`its ledger call: ${calls.map((call) => call.status).join(", ") || "none"} (expected one, completed)`);
  return {
    batchId: batch.batchId,
    jobId,
    childExecutions: children.length,
    deliveries: ran,
    ledgerEntries: entries,
    ledgerRequests: stub.ledgerRequests.filter((request) => request.jobId === jobId).length,
    outboundCalls: calls.map((call) => call.status),
    attempts,
    problems,
  };
}

/** Whether the jobs show what the scenario did on purpose. */
function isFound(expectation: Expectation, jobs: readonly JobVerification[]): boolean {
  const inBatch = jobs.filter((job) => job.batchId === expectation.batchId);
  const scope = expectation.jobId === undefined ? inBatch : inBatch.filter((job) => job.jobId === expectation.jobId);
  const ofInstance = (attempt: WriteAttempt): boolean =>
    expectation.instanceId === undefined || attempt.instanceId === expectation.instanceId;
  const has = (verdict: WriteVerdict): boolean =>
    scope.some((job) => job.attempts.some((attempt) => attempt.verdict === verdict && ofInstance(attempt)));
  switch (expectation.kind) {
    case "refused":
      return has(WriteVerdict.Refused);
    case "never-attempted":
      // never attempted — and so never counted as a refusal
      return has(WriteVerdict.NeverAttempted) && !scope.some((job) => job.attempts.some((attempt) => attempt.verdict === WriteVerdict.Refused));
    case "replayed":
      return has(WriteVerdict.Replayed);
    case "accepted-by":
      return expectation.instanceId !== undefined && has(WriteVerdict.Accepted);
  }
}

/** The report of a run: `passed` only when every job is exactly once and every expectation is found. */
export function verifyRun(input: {
  readonly batches: readonly BatchEvidence[];
  readonly stub: StubState;
  readonly expectations: readonly Expectation[];
}): VerificationReport {
  const jobs: JobVerification[] = [];
  const batches = input.batches.map((batch) => {
    const problems: string[] = [];
    const { record } = batch;
    if (record === undefined) problems.push("no execution record kept for the batch");
    else if (record.status !== ExecutionHistoryStatus.Finished) problems.push(`the batch ended ${record.status}`);
    const output = (record?.output ?? {}) as Record<string, unknown>;
    if (record !== undefined && output["jobs"] !== batch.jobIds.length)
      problems.push(`its output says ${String(output["jobs"])} jobs, ${String(batch.jobIds.length)} were submitted`);
    const ran = batch.leaseEvents.filter((event) => isDeliver(event) && event.outcome === FencedEffectEventOutcome.Ran).length;
    if (ran !== batch.jobIds.length) problems.push(`${String(ran)} deliveries ran in its tree for ${String(batch.jobIds.length)} jobs`);
    for (const jobId of batch.jobIds) jobs.push(verifyJob(batch, jobId, input.stub));
    return { batchId: batch.batchId, status: record?.status ?? "missing", jobs: batch.jobIds.length, problems };
  });
  const expectations = input.expectations.map((expectation) => ({ ...expectation, found: isFound(expectation, jobs) }));
  const count = (verdict: WriteVerdict): number =>
    jobs.reduce((sum, job) => sum + job.attempts.filter((attempt) => attempt.verdict === verdict).length, 0);
  const duplicates = jobs.reduce(
    (sum, job) => sum + Math.max(0, job.deliveries - 1) + Math.max(0, job.ledgerEntries - 1) + Math.max(0, job.childExecutions - 1),
    0,
  );
  const passed =
    batches.every((batch) => batch.problems.length === 0) &&
    jobs.every((job) => job.problems.length === 0) &&
    expectations.every((expectation) => expectation.found);
  return {
    passed,
    batches,
    jobs,
    expectations,
    totals: {
      jobs: jobs.length,
      duplicates,
      [WriteVerdict.Accepted]: count(WriteVerdict.Accepted),
      [WriteVerdict.Replayed]: count(WriteVerdict.Replayed),
      [WriteVerdict.Refused]: count(WriteVerdict.Refused),
      [WriteVerdict.NeverAttempted]: count(WriteVerdict.NeverAttempted),
      [WriteVerdict.Inconsistent]: count(WriteVerdict.Inconsistent),
    },
  };
}
