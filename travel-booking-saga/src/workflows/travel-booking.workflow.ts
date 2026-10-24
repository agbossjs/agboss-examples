import {
  Workflow,
  WorkflowFinish,
  WorkflowStart,
  listOf,
  start,
  toAction,
} from "agboss";
import { seconds } from "agboss/units";
import {
  CancelFlightCompensationAction,
  CancelHotelCompensationAction,
  CapturePaymentAction,
  ConfirmBookingAction,
  FinalizeApprovedHoldAction,
  FinalizeBudgetItineraryAction,
  FinalizeQuorumBookingAction,
  FormatRolledBackBookingAction,
  RefundPaymentCompensationAction,
  ReserveFlightAction,
  ReserveHotelAction,
} from "../actions/booking.actions.js";
import {
  BookingQuorumArbiter,
  ComplianceReviewerAgent,
  FinanceReviewerAgent,
  ItineraryBriefAgent,
  ManagerApprovalCoordinatorAgent,
  RiskReviewerAgent,
} from "../arbiters/booking-quorum.arbiter.js";
import { RequestManagerApprovalTool } from "../channels/booking-approval.channel.js";
import { FakeAirlineService } from "../infrastructure/fake-airline.js";
import { FakeHotelService } from "../infrastructure/fake-hotel.js";
import {
  FakePaymentService,
  PaymentDeclinedError,
} from "../infrastructure/fake-payments.js";
import {
  FlightReservationDto,
  HighValueHoldOutputDto,
  HotelReservationDto,
  ItineraryBriefDto,
  PaymentCaptureDto,
  ReviewerVoteDto,
  TravelBookingOutcomeDto,
  TravelBookingRequestDto,
} from "./dtos.js";

@WorkflowStart({
  name: "payment-saga-workflow-start",
  description: "Entry point for flight + hotel + payment booking saga",
  input: TravelBookingRequestDto,
})
export class PaymentSagaWorkflowStart {}

@WorkflowFinish({
  name: "payment-saga-workflow-finish",
  description: "Terminal finish for flight + hotel + payment booking saga",
  output: TravelBookingOutcomeDto,
})
export class PaymentSagaWorkflowFinish {}

@Workflow({
  name: "payment-saga-workflow",
  version: "0.1.0",
  flow: [
    start(PaymentSagaWorkflowStart)
      .returns(TravelBookingRequestDto)
      .toAction(ReserveFlightAction)
      .returns(FlightReservationDto)
      .toAction(ReserveHotelAction)
      .returns(HotelReservationDto)
      .toAction(CapturePaymentAction)
      .onError(
        PaymentDeclinedError,
        toAction(CancelHotelCompensationAction)
          .toAction(CancelFlightCompensationAction)
          .toAction(FormatRolledBackBookingAction)
          .returns(TravelBookingOutcomeDto)
          .toFinish(PaymentSagaWorkflowFinish),
      )
      .returns(PaymentCaptureDto)
      .toAction(ConfirmBookingAction)
      .returns(TravelBookingOutcomeDto)
      .toFinish(PaymentSagaWorkflowFinish),
  ],
  providers: [
    FakeAirlineService,
    FakeHotelService,
    FakePaymentService,
    RefundPaymentCompensationAction,
  ],
})
export class PaymentSagaWorkflow {}

@WorkflowStart({
  name: "budget-saga-workflow-start",
  description: "Entry point for flight + hotel + LLM itinerary brief saga (tests BudgetExceededError rollback)",
  input: TravelBookingRequestDto,
})
export class BudgetSagaWorkflowStart {}

@WorkflowFinish({
  name: "budget-saga-workflow-finish",
  description: "Terminal finish for budget itinerary saga",
  output: TravelBookingOutcomeDto,
})
export class BudgetSagaWorkflowFinish {}

@Workflow({
  name: "budget-saga-workflow",
  version: "0.1.0",
  flow: [
    start(BudgetSagaWorkflowStart)
      .returns(TravelBookingRequestDto)
      .toAction(ReserveFlightAction)
      .returns(FlightReservationDto)
      .toAction(ReserveHotelAction)
      .returns(HotelReservationDto)
      .toAgent(ItineraryBriefAgent)
      .returns(ItineraryBriefDto)
      .toAction(FinalizeBudgetItineraryAction)
      .returns(TravelBookingOutcomeDto)
      .toFinish(BudgetSagaWorkflowFinish),
  ],
  providers: [FakeAirlineService, FakeHotelService],
})
export class BudgetSagaWorkflow {}

@WorkflowStart({
  name: "hitl-hold-saga-workflow-start",
  description: "Entry point for flight + hotel + human manager approval pause saga",
  input: TravelBookingRequestDto,
})
export class HitlHoldSagaWorkflowStart {}

@WorkflowFinish({
  name: "hitl-hold-saga-workflow-finish",
  description: "Terminal finish for human manager approval pause saga",
  output: TravelBookingOutcomeDto,
})
export class HitlHoldSagaWorkflowFinish {}

@Workflow({
  name: "hitl-hold-saga-workflow",
  version: "0.1.0",
  flow: [
    start(HitlHoldSagaWorkflowStart)
      .returns(TravelBookingRequestDto)
      .toAction(ReserveFlightAction)
      .returns(FlightReservationDto)
      .toAction(ReserveHotelAction)
      .returns(HotelReservationDto)
      .toAgent(ManagerApprovalCoordinatorAgent)
      .returns(HighValueHoldOutputDto)
      .toAction(FinalizeApprovedHoldAction)
      .returns(TravelBookingOutcomeDto)
      .toFinish(HitlHoldSagaWorkflowFinish),
  ],
  providers: [
    FakeAirlineService,
    FakeHotelService,
    RequestManagerApprovalTool,
  ],
})
export class HitlHoldSagaWorkflow {}

@WorkflowStart({
  name: "quorum-saga-workflow-start",
  description: "Entry point for 2-of-3 parallel reviewer quorum booking saga",
  input: TravelBookingRequestDto,
})
export class QuorumSagaWorkflowStart {}

@WorkflowFinish({
  name: "quorum-saga-workflow-finish",
  description: "Terminal finish for 2-of-3 parallel reviewer quorum booking saga",
  output: TravelBookingOutcomeDto,
})
export class QuorumSagaWorkflowFinish {}

@Workflow({
  name: "quorum-saga-workflow",
  version: "0.1.0",
  flow: [
    start(QuorumSagaWorkflowStart)
      .returns(TravelBookingRequestDto)
      .toAction(ReserveFlightAction)
      .returns(FlightReservationDto)
      .toAction(ReserveHotelAction)
      .returns(HotelReservationDto)
      .toParallelAgents(
        FinanceReviewerAgent,
        ComplianceReviewerAgent,
        RiskReviewerAgent,
      )
      .acceptedBy(BookingQuorumArbiter)
      .joinQuorum({ min: 2, max: 2, deadline: seconds(15) })
      .returns(listOf(ReviewerVoteDto))
      .toAction(FinalizeQuorumBookingAction)
      .returns(TravelBookingOutcomeDto)
      .toFinish(QuorumSagaWorkflowFinish),
  ],
  providers: [
    FakeAirlineService,
    FakeHotelService,
    RequestManagerApprovalTool,
  ],
})
export class QuorumSagaWorkflow {}
