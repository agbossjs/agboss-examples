import { start, Workflow } from "@agboss/core";
import { ProcessJobAction } from "../../actions/process-job.action.js";
import { JobDoneDto } from "../../dto/job-done.dto.js";
import { JobDto } from "../../dto/job.dto.js";
import { JobDoneWorkflowFinish } from "./job.workflow-finish.js";
import { JobWorkflowStart } from "./job.workflow-start.js";

/** One job: one action step — what takes a worker's step slot. */
@Workflow({
  name: "job-workflow",
  version: "1.0.0",
  flow: [
    start(JobWorkflowStart)
      .returns(JobDto)
      .toAction(ProcessJobAction)
      .returns(JobDoneDto)
      .toFinish(JobDoneWorkflowFinish),
  ],
})
export class JobWorkflow {}
