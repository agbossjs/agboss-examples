import {
  Action,
  type ActionHandler,
  ExecutionContext,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { FlightReservationDto } from "../dto/flight-reservation.dto.js";
import { HotelReservationDto } from "../dto/hotel-reservation.dto.js";
import { TravelBookingRequestDto } from "../dto/travel-booking-request.dto.js";
import { FakeHotelService } from "../services/fake-hotel.service.js";
import { CancelHotelCompensationAction } from "./cancel-hotel-compensation.action.js";

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
