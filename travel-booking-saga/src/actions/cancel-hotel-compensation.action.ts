import {
  Action,
  type ActionHandler,
  ExecutionContext,
  type InputOf,
} from "agboss";
import { HotelReservationDto } from "../dto/hotel-reservation.dto.js";
import { TravelBookingRequestDto } from "../dto/travel-booking-request.dto.js";
import { FakeHotelService } from "../services/fake-hotel.service.js";

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
