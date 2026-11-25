import { Float, Text } from "@agboss/core/dto";

export class HighValueHoldInputDto {
  @Text({ prompt: "Booking ID requiring manager approval" })
  bookingId!: string;

  @Float({ prompt: "Total amount in USD requiring approval", min: 0 })
  amountUsd!: number;
}
