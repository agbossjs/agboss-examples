import { Workflow, onStart, toAgent, Ttl } from "@agboss/core";
import { seconds } from "@agboss/core/units";
import { FinalizeQuorumBookingAction } from "../../actions/finalize-quorum-booking.action.js";
import { ReserveFlightAction } from "../../actions/reserve-flight.action.js";
import { ReserveHotelAction } from "../../actions/reserve-hotel.action.js";
import { ComplianceReviewerAgent } from "../../agents/compliance-reviewer/compliance-reviewer.agent.js";
import { FinanceReviewerAgent } from "../../agents/finance-reviewer/finance-reviewer.agent.js";
import { RiskReviewerAgent } from "../../agents/risk-reviewer/risk-reviewer.agent.js";
import { BookingQuorumArbiter } from "../../arbiters/booking-quorum/booking-quorum.arbiter.js";
import { FakeAirlineService } from "../../services/fake-airline.service.js";
import { FakeHotelService } from "../../services/fake-hotel.service.js";
import { RequestManagerApprovalTool } from "../../tools/request-manager-approval.tool.js";
import { QuorumSagaWorkflowFinish } from "./quorum-saga.workflow-finish.js";
import { QuorumSagaWorkflowStart } from "./quorum-saga.workflow-start.js";

@Workflow({
  name: "quorum-saga-workflow",
  version: "0.1.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(QuorumSagaWorkflowStart)
      .toAction(ReserveFlightAction)
      .toAction(ReserveHotelAction)
      .inParallel([toAgent(FinanceReviewerAgent), toAgent(ComplianceReviewerAgent), toAgent(RiskReviewerAgent)])
      .arbitratedBy(BookingQuorumArbiter)
      .joinQuorum({ min: 2, max: 2, deadline: seconds(15) })
      .toAction(FinalizeQuorumBookingAction)
      .toFinish(QuorumSagaWorkflowFinish),
  ],
  providers: [FakeAirlineService, FakeHotelService, RequestManagerApprovalTool],
})
export class QuorumSagaWorkflow {}
