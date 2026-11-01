import { Workflow, start } from "@agboss/core";
import { SettleAuthorizationAction } from "../../actions/settle-authorization.action.js";
import { DispositionRequestDto } from "../../dto/disposition-request.dto.js";
import { MovementDto } from "../../dto/movement.dto.js";
import { SettleWorkflowFinish } from "./settle.workflow-finish.js";
import { SettleWorkflowStart } from "./settle.workflow-start.js";

/** PS20: fulfilment captures the whole authorization. */
@Workflow({
  name: "settle-workflow",
  version: "1.0.0",
  flow: [
    start(SettleWorkflowStart)
      .returns(DispositionRequestDto)
      .toAction(SettleAuthorizationAction)
      .returns(MovementDto)
      .toFinish(SettleWorkflowFinish),
  ],
})
export class SettleWorkflow {}
