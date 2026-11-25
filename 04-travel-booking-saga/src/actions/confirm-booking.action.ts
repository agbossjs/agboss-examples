import { Action, type ActionHandler, ExecutionContext, type InputOf, type OutputOf } from "@agboss/core";
import { FlightReservationDto } from "../dto/flight-reservation.dto.js";
import { HotelReservationDto } from "../dto/hotel-reservation.dto.js";
import { PaymentCaptureDto } from "../dto/payment-capture.dto.js";
import { TravelBookingOutcomeDto } from "../dto/travel-booking-outcome.dto.js";
import { TravelBookingRequestDto } from "../dto/travel-booking-request.dto.js";
import { FakeAirlineService } from "../services/fake-airline.service.js";
import { FakeHotelService } from "../services/fake-hotel.service.js";

@Action({
  name: "confirm-booking-action",
  description:
    "Finalizes confirmed flight, hotel, and payment into a TravelBookingOutcomeDto",
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

  async execute(
    input: InputOf<ConfirmBookingAction>,
  ): Promise<OutputOf<ConfirmBookingAction>> {
    this.airline.confirmSeat({
      flightReservationId: input.flight.flightReservationId,
      idempotencyKey: `${this.executionContext.step.idempotencyKey}:airline`,
    });
    this.hotel.confirmRoom({
      hotelReservationId: input.hotel.hotelReservationId,
      idempotencyKey: `${this.executionContext.step.idempotencyKey}:hotel`,
    });
    return Object.assign(new TravelBookingOutcomeDto(), {
      bookingId: input.request.bookingId,
      status: "CONFIRMED",
      flightReservationId: input.flight.flightReservationId,
      hotelReservationId: input.hotel.hotelReservationId,
      summary: `Confirmed ${input.flight.flightReservationId} + ${input.hotel.hotelReservationId} (${input.payment.paymentTransactionId})`,
    });
  }
}
