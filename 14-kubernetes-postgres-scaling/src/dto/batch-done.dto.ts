import { Integer } from "@agboss/core/dto";

/** A batch, done: how many jobs, on how many workers. */
export class BatchDoneDto {
  @Integer({ prompt: "the jobs done" })
  jobs!: number;

  @Integer({ prompt: "the workers that ran them" })
  workers!: number;
}
