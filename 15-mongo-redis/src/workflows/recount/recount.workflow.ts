import { ChildPlacement, listOf, oneOf, start, Workflow } from "@agboss/core";
import { ShelfCountDto } from "../../dto/shelf-count.dto.js";
import { ShelfFailedDto } from "../../dto/shelf-failed.dto.js";
import { ShelfDto } from "../../dto/shelf.dto.js";
import { ShelfWorkflow } from "../shelf/shelf.workflow.js";
import { RecountDoneWorkflowFinish } from "./recount.workflow-finish.js";
import { RecountWorkflowStart } from "./recount.workflow-start.js";

/**
 * The recount: one `shelf-workflow` per shelf, queued in the shared child queue
 * (`ChildPlacement.AnyInstance` — on Redis, `RedisChildExecutionQueueRepository`), claimed by any
 * instance with a free step slot; the parent waits on its Redis lease and joins every count.
 */
@Workflow({
  name: "recount-workflow",
  version: "1.0.0",
  flow: [
    start(RecountWorkflowStart)
      .returns(listOf(ShelfDto))
      .toParallelWorkflows(ShelfWorkflow, {
        maxConcurrency: 50,
        maxItems: 50,
        placement: ChildPlacement.AnyInstance,
      })
      .join()
      .returns(listOf(oneOf(ShelfCountDto, ShelfFailedDto)))
      .toFinish(RecountDoneWorkflowFinish),
  ],
})
export class RecountWorkflow {}
