import {
  Action,
  ApplicationContext,
  Clock,
  ExecutionContext,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { seconds } from "@agboss/core/units";
import { JobDoneDto } from "../dto/job-done.dto.js";
import { JobDto } from "../dto/job.dto.js";

/** Works on one job for its `durationMs` — on the app's clock, so a step slot is busy meanwhile. */
@Action({
  name: "process-job-action",
  description: "Works on one job and says which worker did it",
  input: { job: JobDto },
  output: JobDoneDto,
  deps: [Clock, ExecutionContext, ApplicationContext],
})
export class ProcessJobAction implements ActionHandler<ProcessJobAction> {
  constructor(
    private readonly clock: Clock,
    private readonly executionContext: ExecutionContext,
    private readonly applicationContext: ApplicationContext,
  ) {}

  async execute(
    input: InputOf<ProcessJobAction>,
  ): Promise<OutputOf<ProcessJobAction>> {
    const { jobId, durationMs } = input.job.value;
    if (durationMs > 0)
      await this.clock.sleep(
        seconds(durationMs / 1000),
        this.executionContext.signal,
      );
    return { jobId, instanceId: this.applicationContext.instanceId };
  }
}
