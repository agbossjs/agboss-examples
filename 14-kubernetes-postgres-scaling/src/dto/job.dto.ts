import { Integer, Text } from "@agboss/core/dto";

/** One unit of queued work: a child workflow on any worker. */
export class JobDto {
  @Text({ prompt: "the job's id" })
  jobId!: string;

  @Integer({ prompt: "how long the job works, in milliseconds" })
  durationMs!: number;
}
