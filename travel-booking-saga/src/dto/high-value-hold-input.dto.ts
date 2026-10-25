import { Decimal, Text } from "agboss/dto";

export class HighValueHoldInputDto {
  @Text({ prompt: "Booking ID requiring manager approval" })
  bookingId!: string;

  @Decimal({ prompt: "Total amount in USD requiring approval", min: 0 })
  amountUsd!: number;
}
