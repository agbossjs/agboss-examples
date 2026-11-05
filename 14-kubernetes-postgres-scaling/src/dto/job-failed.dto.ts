import { Text } from "@agboss/core/dto";

/** A job that failed: it ended at its own failure finish, and its batch went on with the others. */
export class JobFailedDto {
  @Text({ prompt: "the job's id" })
  jobId!: string;
}
