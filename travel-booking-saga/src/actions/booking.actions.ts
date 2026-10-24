import {
  Action,
  type ActionHandler,
  ExecutionContext,
  type InputOf,
  type OutputOf,
} from "agboss";
import { FakeAirlineService } from "../infrastructure/fake-airline.js";
import { FakeHotelService } from "../infrastructure/fake-hotel.js";
import { FakePaymentService } from "../infrastructure/fake-payments.js";
import {
  FlightReservationDto,
  HotelReservationDto,
  HighValueHoldOutputDto,
  ItineraryBriefDto,
  PaymentCaptureDto,
  ReviewerVoteDto,
  TravelBookingOutcomeDto,
  TravelBookingRequestDto,
} from "../workflows/dtos.js";
import { listOf } from "agboss/dto";

@Action({
  name: "cancel-flight-compensation-action",
  description: "Releases the held airline seat during saga rollback",
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
  },
  deps: [FakeAirlineService, ExecutionContext],
})
export class CancelFlightCompensationAction
  implements ActionHandler<CancelFlightCompensationAction>
{
  constructor(
    private readonly airline: FakeAirlineService,
    private readonly executionContext: ExecutionContext,
  ) {}

  async execute(input: InputOf<CancelFlightCompensationAction>): Promise<void> {
    this.airline.releaseSeat({
      bookingId: input.request.value.bookingId,
      flightReservationId: input.flight.value.flightReservationId,
      idempotencyKey: this.executionContext.step.idempotencyKey,
    });
  }
}

@Action({
  name: "reserve-flight-action",
  description: "Reserves a seat with the external airline service",
  input: { request: TravelBookingRequestDto },
  output: FlightReservationDto,
  compensateWith: CancelFlightCompensationAction,
  deps: [FakeAirlineService, ExecutionContext],
})
export class ReserveFlightAction implements ActionHandler<ReserveFlightAction> {
  constructor(
    private readonly airline: FakeAirlineService,
    private readonly executionContext: ExecutionContext,
  ) {}

  async execute(input: InputOf<ReserveFlightAction>): Promise<OutputOf<ReserveFlightAction>> {
    const res = this.airline.reserveSeat({
      bookingId: input.request.value.bookingId,
      flightCode: input.request.value.flightCode,
      idempotencyKey: this.executionContext.step.idempotencyKey,
    });
    return Object.assign(new FlightReservationDto(), res);
  }
}

@Action({
  name: "cancel-hotel-compensation-action",
  description: "Releases the held hotel room during saga rollback",
  input: {
    request: TravelBookingRequestDto,
    hotel: HotelReservationDto,
  },
  deps: [FakeHotelService, ExecutionContext],
})
export class CancelHotelCompensationAction
  implements ActionHandler<CancelHotelCompensationAction>
{
  constructor(
    private readonly hotel: FakeHotelService,
    private readonly executionContext: ExecutionContext,
  ) {}

  async execute(input: InputOf<CancelHotelCompensationAction>): Promise<void> {
    this.hotel.releaseRoom({
      bookingId: input.request.value.bookingId,
      hotelReservationId: input.hotel.value.hotelReservationId,
      idempotencyKey: this.executionContext.step.idempotencyKey,
    });
  }
}

@Action({
  name: "reserve-hotel-action",
  description: "Reserves a room with the external hotel service",
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
  },
  output: HotelReservationDto,
  compensateWith: CancelHotelCompensationAction,
  deps: [FakeHotelService, ExecutionContext],
})
export class ReserveHotelAction implements ActionHandler<ReserveHotelAction> {
  constructor(
    private readonly hotel: FakeHotelService,
    private readonly executionContext: ExecutionContext,
  ) {}

  async execute(input: InputOf<ReserveHotelAction>): Promise<OutputOf<ReserveHotelAction>> {
    void input.flight.value.flightReservationId;
    const res = this.hotel.reserveRoom({
      bookingId: input.request.value.bookingId,
      hotelCode: input.request.value.hotelCode,
      idempotencyKey: this.executionContext.step.idempotencyKey,
    });
    return Object.assign(new HotelReservationDto(), res);
  }
}

@Action({
  name: "refund-payment-compensation-action",
  description: "Voids or refunds the captured payment during saga rollback",
  input: { payment: PaymentCaptureDto },
  deps: [FakePaymentService, ExecutionContext],
})
export class RefundPaymentCompensationAction
  implements ActionHandler<RefundPaymentCompensationAction>
{
  constructor(
    private readonly payments: FakePaymentService,
    private readonly executionContext: ExecutionContext,
  ) {}

  async execute(input: InputOf<RefundPaymentCompensationAction>): Promise<void> {
    this.payments.voidOrRefund({
      paymentTransactionId: input.payment.value.paymentTransactionId,
      idempotencyKey: this.executionContext.step.idempotencyKey,
    });
  }
}

@Action({
  name: "capture-payment-action",
  description: "Authorizes and captures payment for the reserved flight and hotel",
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
  },
  output: PaymentCaptureDto,
  compensateWith: RefundPaymentCompensationAction,
  deps: [FakePaymentService, ExecutionContext],
})
export class CapturePaymentAction implements ActionHandler<CapturePaymentAction> {
  constructor(
    private readonly payments: FakePaymentService,
    private readonly executionContext: ExecutionContext,
  ) {}

  async execute(input: InputOf<CapturePaymentAction>): Promise<OutputOf<CapturePaymentAction>> {
    void input.flight.value.flightReservationId;
    void input.hotel.value.hotelReservationId;
    const res = this.payments.authorizeAndCapture({
      bookingId: input.request.value.bookingId,
      amountUsd: input.request.value.totalAmountUsd,
      simulateDecline: input.request.value.simulatePaymentDecline,
      idempotencyKey: this.executionContext.step.idempotencyKey,
    });
    return Object.assign(new PaymentCaptureDto(), res);
  }
}

@Action({
  name: "confirm-booking-action",
  description: "Finalizes confirmed flight, hotel, and payment into a TravelBookingOutcomeDto",
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
    payment: PaymentCaptureDto,
  },
  output: TravelBookingOutcomeDto,
  deps: [FakeAirlineService, FakeHotelService, ExecutionContext],
})
export class ConfirmBookingAction implements ActionHandler<ConfirmBookingAction> {
  constructor(
    private readonly airline: FakeAirlineService,
    private readonly hotel: FakeHotelService,
    private readonly executionContext: ExecutionContext,
  ) {}

  async execute(input: InputOf<ConfirmBookingAction>): Promise<OutputOf<ConfirmBookingAction>> {
    this.airline.confirmSeat({
      flightReservationId: input.flight.value.flightReservationId,
      idempotencyKey: `${this.executionContext.step.idempotencyKey}:airline`,
    });
    this.hotel.confirmRoom({
      hotelReservationId: input.hotel.value.hotelReservationId,
      idempotencyKey: `${this.executionContext.step.idempotencyKey}:hotel`,
    });
    return Object.assign(new TravelBookingOutcomeDto(), {
      bookingId: input.request.value.bookingId,
      status: "CONFIRMED",
      flightReservationId: input.flight.value.flightReservationId,
      hotelReservationId: input.hotel.value.hotelReservationId,
      summary: `Confirmed ${input.flight.value.flightReservationId} + ${input.hotel.value.hotelReservationId} (${input.payment.value.paymentTransactionId})`,
    });
  }
}

@Action({
  name: "format-rolled-back-booking-action",
  description: "Formats a clean ROLLED_BACK outcome after LIFO compensations run on the error side-path",
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
  },
  output: TravelBookingOutcomeDto,
})
export class FormatRolledBackBookingAction
  implements ActionHandler<FormatRolledBackBookingAction>
{
  async execute(
    input: InputOf<FormatRolledBackBookingAction>,
  ): Promise<OutputOf<FormatRolledBackBookingAction>> {
    return Object.assign(new TravelBookingOutcomeDto(), {
      bookingId: input.request.value.bookingId,
      status: "ROLLED_BACK",
      flightReservationId: input.flight.value.flightReservationId,
      hotelReservationId: input.hotel.value.hotelReservationId,
      summary: `Rolled back ${input.hotel.value.hotelReservationId} then ${input.flight.value.flightReservationId} after payment decline`,
    });
  }
}

@Action({
  name: "finalize-budget-itinerary-action",
  description: "Finalizes itinerary after LLM brief generation",
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
    brief: ItineraryBriefDto,
  },
  output: TravelBookingOutcomeDto,
})
export class FinalizeBudgetItineraryAction
  implements ActionHandler<FinalizeBudgetItineraryAction>
{
  async execute(
    input: InputOf<FinalizeBudgetItineraryAction>,
  ): Promise<OutputOf<FinalizeBudgetItineraryAction>> {
    return Object.assign(new TravelBookingOutcomeDto(), {
      bookingId: input.request.value.bookingId,
      status: "CONFIRMED",
      flightReservationId: input.flight.value.flightReservationId,
      hotelReservationId: input.hotel.value.hotelReservationId,
      summary: input.brief.value.brief,
    });
  }
}

@Action({
  name: "finalize-approved-hold-action",
  description: "Finalizes booking after manager approval resumes",
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
    hold: HighValueHoldOutputDto,
  },
  output: TravelBookingOutcomeDto,
})
export class FinalizeApprovedHoldAction
  implements ActionHandler<FinalizeApprovedHoldAction>
{
  async execute(
    input: InputOf<FinalizeApprovedHoldAction>,
  ): Promise<OutputOf<FinalizeApprovedHoldAction>> {
    return Object.assign(new TravelBookingOutcomeDto(), {
      bookingId: input.request.value.bookingId,
      status: input.hold.value.approved ? "CONFIRMED" : "REJECTED",
      flightReservationId: input.flight.value.flightReservationId,
      hotelReservationId: input.hotel.value.hotelReservationId,
      summary: `Manager decision token: ${input.hold.value.approvalToken}`,
    });
  }
}

@Action({
  name: "finalize-quorum-booking-action",
  description: "Finalizes booking once 2-of-3 reviewer quorum is reached",
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
    votes: listOf(ReviewerVoteDto),
  },
  output: TravelBookingOutcomeDto,
})
export class FinalizeQuorumBookingAction
  implements ActionHandler<FinalizeQuorumBookingAction>
{
  async execute(
    input: InputOf<FinalizeQuorumBookingAction>,
  ): Promise<OutputOf<FinalizeQuorumBookingAction>> {
    const countedDepartments = input.votes.map((v) => v.value.department);

    return Object.assign(new TravelBookingOutcomeDto(), {
      bookingId: input.request.value.bookingId,
      status: "CONFIRMED_BY_QUORUM",
      flightReservationId: input.flight.value.flightReservationId,
      hotelReservationId: input.hotel.value.hotelReservationId,
      summary: `Quorum achieved (${String(countedDepartments.length)}/3): ${countedDepartments.join(", ")}`,
    });
  }
}
