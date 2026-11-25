import { Workflow, onStart, Ttl } from "@agboss/core";
import { FinalizeApprovedHoldAction } from "../../actions/finalize-approved-hold.action.js";
import { ReserveFlightAction } from "../../actions/reserve-flight.action.js";
import { ReserveHotelAction } from "../../actions/reserve-hotel.action.js";
import { ManagerApprovalCoordinatorAgent } from "../../agents/manager-approval-coordinator/manager-approval-coordinator.agent.js";
import { FakeAirlineService } from "../../services/fake-airline.service.js";
import { FakeHotelService } from "../../services/fake-hotel.service.js";
import { RequestManagerApprovalTool } from "../../tools/request-manager-approval.tool.js";
import { HitlHoldSagaWorkflowFinish } from "./hitl-hold-saga.workflow-finish.js";
import { HitlHoldSagaWorkflowStart } from "./hitl-hold-saga.workflow-start.js";

@Workflow({
  name: "hitl-hold-saga-workflow",
  version: "0.1.0",
  historyTtl: Ttl.Forever,
  executionLimits: { maxSteps: 4 },
  flow: [
    onStart(HitlHoldSagaWorkflowStart)
      .toAction(ReserveFlightAction)
      .toAction(ReserveHotelAction)
      .toAgent(ManagerApprovalCoordinatorAgent)
      .toAction(FinalizeApprovedHoldAction)
      .toFinish(HitlHoldSagaWorkflowFinish),
  ],
  providers: [FakeAirlineService, FakeHotelService, RequestManagerApprovalTool],
})
export class HitlHoldSagaWorkflow {}
