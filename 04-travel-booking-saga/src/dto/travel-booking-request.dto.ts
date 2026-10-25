import { Decimal, Flag, Text } from "agboss/dto";

export class TravelBookingRequestDto {
  @Text({ prompt: "Unique booking reference ID" })
  bookingId!: string;

  @Text({ prompt: "Traveler ID" })
  travelerId!: string;

  @Text({ prompt: "Flight code (e.g., SFO-NRT-101)" })
  flightCode!: string;

  @Text({ prompt: "Hotel code (e.g., TOKYO-GRAND-5)" })
  hotelCode!: string;

  @Decimal({ prompt: "Total trip cost in USD", min: 0 })
  totalAmountUsd!: number;

  @Flag({ prompt: "Whether payment gateway should decline the card" })
  simulatePaymentDecline!: boolean;
}
