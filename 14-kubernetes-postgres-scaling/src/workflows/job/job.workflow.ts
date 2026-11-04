import { start, StepFailedError, toFinish, Workflow } from "@agboss/core";
import { ProcessJobAction } from "../../actions/process-job.action.js";
import { JobReceiptDto } from "../../dto/job-receipt.dto.js";
import { JobDto } from "../../dto/job.dto.js";
import { JobDoneWorkflowFinish } from "./job.workflow-finish.js";
import { JobFailedWorkflowFinish } from "./job-failed.workflow-finish.js";
import { JobWorkflowStart } from "./job.workflow-start.js";
import { LedgerClient } from "../../services/ledger.client.js";
import { WorkClient } from "../../services/work.client.js";

/**
 * One job: one action step — what takes a worker's step slot (`ProcessJobAction`). A step that
 * fails (`StepFailedError`: the work rejected, the ledger call unsettled) ends the job at its own
 * failure finish, so the batch goes on with its other jobs (agbossjs/agboss#763). A hand-over — a
 * lease lost, a write fenced — is no step failure: another pod continues the job.
 */
@Workflow({
  name: "job-workflow",
  version: "1.0.0",
  flow: [
    start(JobWorkflowStart)
      .returns(JobDto)
      .toAction(ProcessJobAction)
      .onError(StepFailedError, toFinish(JobFailedWorkflowFinish))
      .returns(JobReceiptDto)
      .toFinish(JobDoneWorkflowFinish),
  ],
  providers: [WorkClient, LedgerClient],
})
export class JobWorkflow {}
