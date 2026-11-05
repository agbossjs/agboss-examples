import { Integer } from "@agboss/core/dto";

/** A batch, ended: how many jobs, how many succeeded and failed, on how many workers. */
export class BatchDoneDto {
  @Integer({ prompt: "the jobs of the batch" })
  jobs!: number;

  @Integer({ prompt: "the jobs done: delivered and entered in the ledger" })
  succeeded!: number;

  @Integer({ prompt: "the jobs that ended at their failure finish" })
  failed!: number;

  @Integer({ prompt: "the workers that ran the jobs done" })
  workers!: number;
}
