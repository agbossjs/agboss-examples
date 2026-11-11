import { ExecutionHistoryRepository, type App } from "@agboss/core";
import type { StubState } from "../stub/ledger-stub.js";
import type { BatchEvidence } from "./verify.js";

/** The tenant every batch of the example runs under. */
export const TENANT = "default";

/** The job ids a batch was started with, from its kept record's input. */
const jobIdsOfInput = (input: unknown): string[] =>
  Array.isArray(input)
    ? input.flatMap((job: unknown) => {
        const jobId = (job as Record<string, unknown> | null)?.["jobId"];
        return typeof jobId === "string" ? [jobId] : [];
      })
    : [];

/**
 * A batch's evidence, through the public API of any instance: its kept record (the history,
 * `retention.executionRecords`), its tree's audit log and its outbound calls. A batch still running
 * has no record yet: its tree is read by `rootExecutionId` (from the stub's work calls).
 */
/** What the reader needs of an app: its container and its operator reads (an `App`, a `TestApp`). */
export type EvidenceSource = Pick<App, "resolve" | "auditLogOf" | "outboundCallsOf">;

export async function batchEvidenceOf(
  app: EvidenceSource,
  batchId: string,
  jobIds?: readonly string[],
  failedJobIds: readonly string[] = [],
): Promise<BatchEvidence> {
  const records = await app.resolve(ExecutionHistoryRepository).findAllByTenantIdAndThreadId(TENANT, batchId);
  const record = records.at(-1);
  if (record === undefined) return { batchId, jobIds: jobIds ?? [], failedJobIds, record, auditLog: [], outboundCalls: [] };
  const tree = { tenantId: TENANT, rootExecutionId: record.rootExecutionId };
  return {
    batchId,
    jobIds: jobIds ?? jobIdsOfInput(record.input),
    failedJobIds,
    record,
    auditLog: await app.auditLogOf(tree),
    outboundCalls: await app.outboundCallsOf(tree),
  };
}

/** The stub's state: what the other system saw. */
export async function stubStateOf(ledgerUrl: string): Promise<StubState> {
  const response = await fetch(`${ledgerUrl}/control/state`);
  if (!response.ok) throw new Error(`the stub's state: HTTP ${String(response.status)}`);
  return (await response.json()) as StubState;
}
