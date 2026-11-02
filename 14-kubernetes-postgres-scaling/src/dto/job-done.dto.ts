import { Text } from "@agboss/core/dto";

/** A job, done: which worker did it. */
export class JobDoneDto {
  @Text({ prompt: "the job's id" })
  jobId!: string;

  @Text({ prompt: "the instance that ran it" })
  instanceId!: string;
}
