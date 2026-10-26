import {
  Action,
  type ActionHandler,
  ExecutionContext,
  type InputOf,
} from "@agboss/core";
import { FlightReservationDto } from "../dto/flight-reservation.dto.js";
import { TravelBookingRequestDto } from "../dto/travel-booking-request.dto.js";
import { FakeAirlineService } from "../services/fake-airline.service.js";

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
