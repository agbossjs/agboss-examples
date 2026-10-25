import { Workflow, start, toAction } from "agboss";
import { CancelFlightCompensationAction } from "../../actions/cancel-flight-compensation.action.js";
import { CancelHotelCompensationAction } from "../../actions/cancel-hotel-compensation.action.js";
import { CapturePaymentAction } from "../../actions/capture-payment.action.js";
import { ConfirmBookingAction } from "../../actions/confirm-booking.action.js";
import { FormatRolledBackBookingAction } from "../../actions/format-rolled-back-booking.action.js";
import { RefundPaymentCompensationAction } from "../../actions/refund-payment-compensation.action.js";
import { ReserveFlightAction } from "../../actions/reserve-flight.action.js";
import { ReserveHotelAction } from "../../actions/reserve-hotel.action.js";
import { FlightReservationDto } from "../../dto/flight-reservation.dto.js";
import { HotelReservationDto } from "../../dto/hotel-reservation.dto.js";
import { PaymentCaptureDto } from "../../dto/payment-capture.dto.js";
import { TravelBookingOutcomeDto } from "../../dto/travel-booking-outcome.dto.js";
import { TravelBookingRequestDto } from "../../dto/travel-booking-request.dto.js";
import { FakeAirlineService } from "../../services/fake-airline.service.js";
import { FakeHotelService } from "../../services/fake-hotel.service.js";
import { FakePaymentService } from "../../services/fake-payment.service.js";
import { PaymentDeclinedError } from "../../services/payment-declined.error.js";
import { PaymentSagaWorkflowFinish } from "./payment-saga.workflow-finish.js";
import { PaymentSagaWorkflowStart } from "./payment-saga.workflow-start.js";

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
