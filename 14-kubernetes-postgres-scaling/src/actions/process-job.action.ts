import {
  Action,
  ApplicationContext,
  ExecutionContext,
  fencedEffectKeyOf,
  OutboundCallReconciliation,
  OutboundCalls,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { JobDto } from "../dto/job.dto.js";
import { JobReceiptDto } from "../dto/job-receipt.dto.js";
import { Deliveries } from "../services/deliveries.js";
import { LedgerClient } from "../services/ledger.client.js";
import { WorkClient } from "../services/work.client.js";

/** The ledger's target name, for operators (`app.outboundCallsOf`). */
const LEDGER = "ledger-stub";

/**
 * One job, the way a worker must do it on several pods (agbossjs/agboss#487):
 *
 * 1. the remote work — the slow part; the client takes no signal (`WorkClient`);
 * 2. the delivery, a fenced effect (#500) keyed by the job (`job:<jobId>`, #508): its receipt is
 *    stored once in the store's own transaction, checked against the step's lease — a step run
 *    again after a crash gets the first receipt back (`Replayed`), a zombie whose lease was taken
 *    over is refused (`ExecutionFencedError`, a hand-over) and writes nothing;
 * 3. the ledger entry, a call that leaves the system (#505): its intent recorded before it is
 *    sent, the Idempotency-Key the ledger deduplicates on, and `reconcile` asking the ledger when
 *    an earlier attempt's outcome is unknown — never a blind resend.
 *
 * No table of its own, no fencing or idempotency bookkeeping: the stores keep it (AC6).
 */
@Action({
  name: "process-job-action",
  description: "Works on one job, delivers it once and records it in the ledger once",
  input: { job: JobDto },
  output: JobReceiptDto,
  deps: [ExecutionContext, ApplicationContext, WorkClient, LedgerClient, Deliveries, OutboundCalls],
})
export class ProcessJobAction implements ActionHandler<ProcessJobAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly applicationContext: ApplicationContext,
    private readonly workClient: WorkClient,
    private readonly ledgerClient: LedgerClient,
    private readonly deliveries: Deliveries,
    private readonly outboundCalls: OutboundCalls,
  ) {}

  async execute(input: InputOf<ProcessJobAction>): Promise<OutputOf<ProcessJobAction>> {
    const { jobId, durationMs } = input.job.value;
    const { instanceId } = this.applicationContext;
    const { podName: pod } = this.applicationContext.environment;
    const { token } = this.executionContext.fence;
    const businessKey = `job:${jobId}`;

    await this.workClient.work({ jobId, durationMs, executionId: this.executionContext.executionId,
      rootExecutionId: this.executionContext.root.executionId,
      instanceId, pod, token });

    const receipt = await this.deliveries.deliverOnce(
      fencedEffectKeyOf(this.executionContext, "deliver", { businessKey }),
      { jobId, instanceId, pod, token },
    );

    const { result: entry } = await this.outboundCalls.send(
      fencedEffectKeyOf(this.executionContext, "ledger", { businessKey }),
      {
        target: LEDGER,
        operation: "record",
        request: { jobId, deliveredBy: receipt.instanceId, pod },
        send: (call) =>
          this.ledgerClient.record(call.request, { idempotencyKey: call.idempotencyKey, signal: call.signal }),
        reconcile: async (lookup) => {
          const found = await this.ledgerClient.find(jobId, lookup.signal);
          return found === undefined ? OutboundCallReconciliation.notSent() : OutboundCallReconciliation.completed(found);
        },
      },
    );
    return { ...receipt, entryId: entry.entryId };
  }
}
