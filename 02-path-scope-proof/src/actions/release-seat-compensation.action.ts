import { Action, type ActionHandler } from "@agboss/core";
import { SeatReservationDto } from "../dto/seat-reservation.dto.js";

@Action({
  name: "release-seat-compensation-fixed-action",
  description: "Releases the reserved airline seat during saga rollback",
  input: { reservation: SeatReservationDto },
})
export class ReleaseSeatCompensationAction
  implements ActionHandler<ReleaseSeatCompensationAction>
{
  async execute(): Promise<void> {
    // the offline proof holds no airline: releasing the seat is the compensation's declared effect, not a call
  }
}
