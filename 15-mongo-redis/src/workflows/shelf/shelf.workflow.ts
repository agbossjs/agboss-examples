import { start, StepFailedError, toFinish, Workflow } from "@agboss/core";
import { CountShelfAction } from "../../actions/count-shelf.action.js";
import { ShelfCountDto } from "../../dto/shelf-count.dto.js";
import { ShelfDto } from "../../dto/shelf.dto.js";
import { ShelfFailedWorkflowFinish } from "./shelf-failed.workflow-finish.js";
import { ShelfCountedWorkflowFinish } from "./shelf.workflow-finish.js";
import { ShelfWorkflowStart } from "./shelf.workflow-start.js";

/**
 * One shelf: one code step — what takes an instance's step slot. A step that fails ends the shelf at
 * its own failure finish, so the recount joins every shelf and is never cancelled by one.
 */
@Workflow({
  name: "shelf-workflow",
  version: "1.0.0",
  flow: [
    start(ShelfWorkflowStart)
      .returns(ShelfDto)
      .toAction(CountShelfAction)
      .onError(StepFailedError, toFinish(ShelfFailedWorkflowFinish))
      .returns(ShelfCountDto)
      .toFinish(ShelfCountedWorkflowFinish),
  ],
})
export class ShelfWorkflow {}
