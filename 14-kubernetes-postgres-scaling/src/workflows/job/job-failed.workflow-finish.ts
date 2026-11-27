import { WorkflowFinish } from "@agboss/core";
import { JobFailedDto } from "../../dto/job-failed.dto.js";

/**
 * Where a failed job ends (agbossjs/agboss#763): its step failed — the other system rejected the
 * work, or its ledger call could not be settled — so the job ends here, a finish of its own, and its
 * batch counts it as failed and goes on with the other jobs. It never cancels the batch.
 */
@WorkflowFinish({
  name: "job-failed-workflow-finish",
  description: "The job failed; the batch goes on without it",
  output: JobFailedDto,
})
export class JobFailedWorkflowFinish {}
