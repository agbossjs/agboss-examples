import { start, Workflow } from "@agboss/core";
import { ProcessJobAction } from "../../actions/process-job.action.js";
import { JobReceiptDto } from "../../dto/job-receipt.dto.js";
import { JobDto } from "../../dto/job.dto.js";
import { JobDoneWorkflowFinish } from "./job.workflow-finish.js";
import { JobWorkflowStart } from "./job.workflow-start.js";
import { LedgerClient } from "../../services/ledger.client.js";
import { WorkClient } from "../../services/work.client.js";

/** One job: one action step — what takes a worker's step slot (`ProcessJobAction`). */
@Workflow({
  name: "job-workflow",
  version: "1.0.0",
  flow: [
    start(JobWorkflowStart)
      .returns(JobDto)
      .toAction(ProcessJobAction)
      .returns(JobReceiptDto)
      .toFinish(JobDoneWorkflowFinish),
  ],
  providers: [WorkClient, LedgerClient],
})
export class JobWorkflow {}
