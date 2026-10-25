import { Text } from "agboss/dto";

export class FlightReservationDto {
  @Text({ prompt: "Booking ID" })
  bookingId!: string;

  @Text({ prompt: "Airline reservation ID" })
  flightReservationId!: string;

  @Text({ prompt: "Airline seat hold code" })
  seatHoldCode!: string;
}
