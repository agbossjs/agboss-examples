import { onStart, toWorkflow, Ttl, Workflow } from "@agboss/core";
import { SummarizeRecountAction } from "../../actions/summarize-recount.action.js";
import { ShelfWorkflow } from "../shelf/shelf.workflow.js";
import { RecountDoneWorkflowFinish } from "./recount.workflow-finish.js";
import { RecountWorkflowStart } from "./recount.workflow-start.js";

/**
 * The recount: one `shelf-workflow` per shelf, queued in the shared child queue
 * (`ShelfWorkflow` is `ChildPlacement.AnyWorker` — on Redis, `RedisChildExecutionQueueRepository`),
 * claimed by any instance with a free step slot; the parent waits on its Redis lease and joins every count.
 */
@Workflow({
  name: "recount-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(RecountWorkflowStart)
      .forEachItem(toWorkflow(ShelfWorkflow), { maxConcurrency: 50, takeFirst: 50 })
      .join()
      .toAction(SummarizeRecountAction)
      .toFinish(RecountDoneWorkflowFinish),
  ],
})
export class RecountWorkflow {}
