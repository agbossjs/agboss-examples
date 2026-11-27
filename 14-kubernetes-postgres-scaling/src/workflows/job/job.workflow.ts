import { ChildPlacement, onStart, StepError, toAction, Ttl, Workflow } from "@agboss/core";
import { MarkJobFailedAction } from "../../actions/mark-job-failed.action.js";
import { ProcessJobAction } from "../../actions/process-job.action.js";
import { JobDoneWorkflowFinish } from "./job.workflow-finish.js";
import { JobFailedWorkflowFinish } from "./job-failed.workflow-finish.js";
import { JobWorkflowStart } from "./job.workflow-start.js";
import { LedgerClient } from "../../services/ledger.client.js";
import { WorkClient } from "../../services/work.client.js";

/**
 * One job: one action step — what takes a worker's step slot (`ProcessJobAction`). A step that
 * fails (`StepError`: the work rejected, the ledger call unsettled) ends the job at its own
 * failure finish, so the batch goes on with its other jobs (agbossjs/agboss#763). A hand-over — a
 * lease lost, a write fenced — is no step failure: another pod continues the job. As a child of a
 * batch it is queued for any worker with a free step slot (`ChildPlacement.AnyWorker`).
 */
@Workflow({
  name: "job-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  placement: ChildPlacement.AnyWorker,
  flow: [
    onStart(JobWorkflowStart)
      .toAction(ProcessJobAction)
      .onError(StepError, toAction(MarkJobFailedAction)
.toFinish(JobFailedWorkflowFinish))
      .toFinish(JobDoneWorkflowFinish),
  ],
  providers: [WorkClient, LedgerClient],
})
export class JobWorkflow {}
