import { Integer, Text } from "@agboss/core/dto";

export class BookingRequestDto {
  @Text({ prompt: "Booking ID" })
  bookingId!: string;

  @Integer({ prompt: "Amount in cents" })
  amountCents!: number;
}
