import { Text } from "@agboss/core/dto";

/**
 * A job, delivered: the receipt its fenced effect stored once (#500) — which instance and pod
 * delivered it — and the ledger entry the other system applied once.
 */
export class JobReceiptDto {
  @Text({ prompt: "the job's id" })
  jobId!: string;

  @Text({ prompt: "the application instance that delivered it" })
  instanceId!: string;

  @Text({ prompt: "the pod that delivered it" })
  pod!: string;

  @Text({ prompt: "the ledger's entry for the job" })
  entryId!: string;
}
