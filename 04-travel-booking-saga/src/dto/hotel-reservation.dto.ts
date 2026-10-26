import { Text } from "@agboss/core/dto";

export class HotelReservationDto {
  @Text({ prompt: "Booking ID" })
  bookingId!: string;

  @Text({ prompt: "Hotel reservation ID" })
  hotelReservationId!: string;

  @Text({ prompt: "Room hold confirmation code" })
  roomHoldCode!: string;
}
