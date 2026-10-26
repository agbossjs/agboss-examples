import { Text } from "@agboss/core/dto";

export class SeatReservationDto {
  @Text({ prompt: "Reservation code" })
  reservationCode!: string;
}
