import {
  Action,
  type ActionHandler,
  ExecutionContext,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { FlightReservationDto } from "../dto/flight-reservation.dto.js";
import { TravelBookingRequestDto } from "../dto/travel-booking-request.dto.js";
import { FakeAirlineService } from "../services/fake-airline.service.js";
import { CancelFlightCompensationAction } from "./cancel-flight-compensation.action.js";

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
