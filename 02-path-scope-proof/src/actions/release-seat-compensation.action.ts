import { Action, type ActionHandler, type InputOf } from "@agboss/core";
import { SeatReservationDto } from "../dto/seat-reservation.dto.js";

@Action({
  name: "release-seat-compensation-fixed-action",
  description: "Releases the reserved airline seat during saga rollback",
  input: { reservation: SeatReservationDto },
})
export class ReleaseSeatCompensationAction
  implements ActionHandler<ReleaseSeatCompensationAction>
{
  async execute(input: InputOf<ReleaseSeatCompensationAction>): Promise<void> {
    void input.reservation.value.reservationCode;
  }
}
