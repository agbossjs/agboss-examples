import { Integer, Text } from "@agboss/core/dto";

/**
 * A job, delivered: the receipt its fenced effect stored once (#500) — which instance and pod
 * delivered it, under which lease token — and the ledger entry the other system applied once.
 */
export class JobReceiptDto {
  @Text({ prompt: "the job's id" })
  jobId!: string;

  @Text({ prompt: "the application instance that delivered it" })
  instanceId!: string;

  @Text({ prompt: "the pod that delivered it" })
  pod!: string;

  @Integer({ prompt: "the lease token the delivery was written under" })
  token!: number;

  @Text({ prompt: "the ledger's entry for the job" })
  entryId!: string;
}
