import { Text } from "agboss/dto";

export class SeatReservationDto {
  @Text({ prompt: "Reservation code" })
  reservationCode!: string;
}
