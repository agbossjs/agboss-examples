import {
  Action,
  ApplicationContext,
  ExecutionContext,
  Idempotency,
  OutboundRecovery,
  Reconciliation,
  type ActionHandler,
  type InferEnv,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { hours, seconds } from "@agboss/core/units";
import { JobDto } from "../dto/job.dto.js";
import { JobReceiptDto } from "../dto/job-receipt.dto.js";
import { scalingEnv } from "../scaling.env.js";
import { LedgerClient } from "../services/ledger.client.js";
import { WorkClient } from "../services/work.client.js";

/** A job's receipt: what its delivery stores, once. */
interface Receipt {
  readonly jobId: string;
  readonly instanceId: string;
  readonly pod: string;
}

/** The ledger's target name, for operators (`app.outboundCallsOf`). */
const LEDGER = "ledger-stub";

/** What the application's effects are bound by: one attempt at most 20 s (below the lease), the rows kept 48 h. */
const BOUNDS = { timeout: seconds(20), ttl: hours(48) } as const;

/**
 * One job, the way a worker must do it on several pods (agbossjs/agboss#487):
 *
 * 1. the remote work — the slow part; the client takes no signal (`WorkClient`);
 * 2. the delivery, `Idempotency.runOnce` (#500) under the job's business key (`job:<jobId>`, #508):
 *    whatever store the application's storage holds — PostgreSQL in the cluster, SQLite locally —
 *    the same code. Its receipt is stored once in the store's own transaction, checked against the
 *    step's lease — a step run again after a crash gets the first receipt back (`Replayed`), a zombie
 *    whose lease was taken over is refused (`ExecutionError.Fenced`, a hand-over) and writes nothing;
 * 3. the ledger entry, `Idempotency.sendOnce`, a call that leaves the system (#505): its intent
 *    recorded before it is sent, the idempotency key the ledger deduplicates on, and a `recovery`
 *    that asks the ledger when an earlier attempt's outcome is unknown — never a blind resend.
 *
 * No table of its own, no fencing or idempotency bookkeeping: the stores keep it (AC6).
 */
@Action({
  name: "process-job-action",
  description: "Works on one job, delivers it once and records it in the ledger once",
  input: { job: JobDto },
  output: JobReceiptDto,
  deps: [ExecutionContext, ApplicationContext, scalingEnv, WorkClient, LedgerClient, Idempotency],
})
export class ProcessJobAction implements ActionHandler<ProcessJobAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly applicationContext: ApplicationContext,
    private readonly settings: InferEnv<typeof scalingEnv>,
    private readonly workClient: WorkClient,
    private readonly ledgerClient: LedgerClient,
    private readonly idempotency: Idempotency,
  ) {}

  async execute(input: InputOf<ProcessJobAction>): Promise<OutputOf<ProcessJobAction>> {
    const { jobId, durationMs } = input.job;
    const { instanceId } = this.applicationContext;
    const { podName: pod } = this.settings;
    const businessKey = `job:${jobId}`;

    await this.workClient.work({ jobId, durationMs, executionId: this.executionContext.executionId,
      rootExecutionId: this.executionContext.root.executionId,
      instanceId, pod });

    const { result: receipt } = await this.idempotency.runOnce<Receipt, { jobId: string }>({
      name: "deliver",
      key: businessKey,
      fingerprint: { jobId },
      ttl: BOUNDS.ttl,
      execute: (): Receipt => ({ jobId, instanceId, pod }),
    });

    const { result: entry } = await this.idempotency.sendOnce({
      name: "ledger",
      key: businessKey,
      ...BOUNDS,
      target: LEDGER,
      operation: "record",
      // what the delivery stored, never this pod's own: a holder that takes the step over replays
      // the receipt and must send the same request, or the business key refuses it (#508)
      request: { jobId, deliveredBy: receipt.instanceId, pod: receipt.pod },
      send: (call) =>
        this.ledgerClient.record(call.request, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
      // the ledger's own entries, by job: a lookup that does not expire (#795)
      recovery: OutboundRecovery.permanentLookup(async (lookup) => {
        const found = await this.ledgerClient.find(jobId, lookup.signal);
        return found === undefined ? Reconciliation.notExecuted() : Reconciliation.completed(found);
      }),
    });
    return { ...receipt, entryId: entry.entryId };
  }
}
