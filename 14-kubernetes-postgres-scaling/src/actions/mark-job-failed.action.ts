import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { JobFailedDto } from "../dto/job-failed.dto.js";
import { JobDto } from "../dto/job.dto.js";

/** The failure path of a job: names the job that failed, for its batch. */
@Action({
  name: "mark-job-failed-action",
  description: "Records which job failed",
  input: { job: JobDto },
  output: JobFailedDto,
})
export class MarkJobFailedAction implements ActionHandler<MarkJobFailedAction> {
  execute(input: InputOf<MarkJobFailedAction>): Promise<OutputOf<MarkJobFailedAction>> {
    return Promise.resolve({ jobId: input.job.jobId });
  }
}
