import { Text } from "@agboss/core/dto";

export class StockReservationDto {
  @Text({ prompt: "the reservation's id" })
  reservationId!: string;
}
