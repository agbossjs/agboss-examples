import { WorkflowFinish, type Produced } from "@agboss/core";
import { JobDto } from "../../dto/job.dto.js";
import { JobFailedDto } from "../../dto/job-failed.dto.js";

/**
 * Where a failed job ends (agbossjs/agboss#763): its step failed — the other system rejected the
 * work, or its ledger call could not be settled — so the job ends here, a finish of its own, and its
 * batch counts it as failed and goes on with the other jobs. It never cancels the batch.
 */
@WorkflowFinish({
  name: "job-failed-workflow-finish",
  description: "The job failed; the batch goes on without it",
  input: { job: JobDto },
  output: JobFailedDto,
})
export class JobFailedWorkflowFinish {
  finish(input: { readonly job: Produced<JobDto, unknown> }): JobFailedDto {
    return { jobId: input.job.value.jobId };
  }
}
