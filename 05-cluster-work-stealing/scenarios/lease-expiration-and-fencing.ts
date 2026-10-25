import {
  ExecutionLeaseLostError,
  ExecutionLeaseRepository,
  ExecutionStatus,
  SqliteConnection,
  type App,
} from "agboss";
import {
  getClusterLedgerSnapshot,
  resetClusterLedger,
  type CommittedChunkEffect,
} from "../src/services/cluster-ledger.service.js";
import { ChunkWorkerWorkflowStart } from "../src/workflows/chunk-worker/chunk-worker.workflow-start.js";

export interface LeaseFencingSummary {
  readonly staleHolderErrorCode: string;
  readonly takeoverStatus: ExecutionStatus;
  readonly ledgerEntries: readonly CommittedChunkEffect[];
}

export async function verifyLeaseRepositoryPing(
  app: Pick<App, "resolve">,
): Promise<boolean> {
  const leaseRepo = app.resolve(ExecutionLeaseRepository);
  await leaseRepo.ping();
  return true;
}

export function simulateHolderLeaseWindowExpiredInStore(
  app: Pick<App, "resolve">,
  rootExecutionId: string,
  tenantId = "default",
): void {
  const connection = app.resolve(SqliteConnection);
  connection.database
    .prepare(
      "UPDATE execution_leases SET expires_at = 0 WHERE tenant_id = ? AND root_execution_id = ?",
    )
    .run(tenantId, rootExecutionId);
}

export function createLeaseFencingAssertionSummary(
  staleError: unknown,
  takeoverStatus: ExecutionStatus,
): LeaseFencingSummary {
  const code =
    staleError instanceof ExecutionLeaseLostError
      ? ExecutionLeaseLostError.code
      : "unexpected";
  return {
    staleHolderErrorCode: code,
    takeoverStatus,
    ledgerEntries: getClusterLedgerSnapshot(),
  };
}

export { ChunkWorkerWorkflowStart, resetClusterLedger };
