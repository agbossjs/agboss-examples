import { ChildPlacement, onStart, StepError, toAction, Ttl, Workflow } from "@agboss/core";
import { CountShelfAction } from "../../actions/count-shelf.action.js";
import { MarkShelfFailedAction } from "../../actions/mark-shelf-failed.action.js";
import { ShelfFailedWorkflowFinish } from "./shelf-failed.workflow-finish.js";
import { ShelfCountedWorkflowFinish } from "./shelf.workflow-finish.js";
import { ShelfWorkflowStart } from "./shelf.workflow-start.js";

/**
 * One shelf: one code step — what takes an instance's step slot. A step that fails ends the shelf at
 * its own failure finish, so the recount joins every shelf and is never cancelled by one. As a child
 * of a recount it is queued for any instance with a free step slot (`ChildPlacement.AnyWorker`).
 */
@Workflow({
  name: "shelf-workflow",
  version: "1.0.0",
  historyTtl: Ttl.Forever,
  placement: ChildPlacement.AnyWorker,
  flow: [
    onStart(ShelfWorkflowStart)
      .toAction(CountShelfAction)
      .onError(StepError, toAction(MarkShelfFailedAction)
        .toFinish(ShelfFailedWorkflowFinish))
      .toFinish(ShelfCountedWorkflowFinish),
  ],
})
export class ShelfWorkflow {}
