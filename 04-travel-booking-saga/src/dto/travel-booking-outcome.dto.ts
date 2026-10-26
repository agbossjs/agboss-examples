import { Text } from "@agboss/core/dto";

export class TravelBookingOutcomeDto {
  @Text({ prompt: "Booking reference ID" })
  bookingId!: string;

  @Text({ prompt: "Final status (CONFIRMED | ROLLED_BACK)" })
  status!: string;

  @Text({ prompt: "Flight reservation ID" })
  flightReservationId!: string;

  @Text({ prompt: "Hotel reservation ID" })
  hotelReservationId!: string;

  @Text({ prompt: "Summary details" })
  summary!: string;
}
