import { Float, Bool, Text } from "@agboss/core/dto";

export class TravelBookingRequestDto {
  @Text({ prompt: "Unique booking reference ID" })
  bookingId!: string;

  @Text({ prompt: "Traveler ID" })
  travelerId!: string;

  @Text({ prompt: "Flight code (e.g., SFO-NRT-101)" })
  flightCode!: string;

  @Text({ prompt: "Hotel code (e.g., TOKYO-GRAND-5)" })
  hotelCode!: string;

  @Float({ prompt: "Total trip cost in USD", min: 0 })
  totalAmountUsd!: number;

  @Bool({ prompt: "Whether payment gateway should decline the card" })
  simulatePaymentDecline!: boolean;
}
