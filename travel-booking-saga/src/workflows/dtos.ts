import { Decimal, Flag, Integer, Text } from "agboss/dto";

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

export class FlightReservationDto {
  @Text({ prompt: "Booking ID" })
  bookingId!: string;

  @Text({ prompt: "Airline reservation ID" })
  flightReservationId!: string;

  @Text({ prompt: "Airline seat hold code" })
  seatHoldCode!: string;
}

export class HotelReservationDto {
  @Text({ prompt: "Booking ID" })
  bookingId!: string;

  @Text({ prompt: "Hotel reservation ID" })
  hotelReservationId!: string;

  @Text({ prompt: "Room hold confirmation code" })
  roomHoldCode!: string;
}

export class PaymentCaptureDto {
  @Text({ prompt: "Payment transaction ID" })
  paymentTransactionId!: string;

  @Decimal({ prompt: "Captured amount in USD", min: 0 })
  capturedAmountUsd!: number;
}

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

export class ItineraryBriefDto {
  @Text({ prompt: "Concise executive itinerary brief" })
  brief!: string;
}

export class HighValueHoldInputDto {
  @Text({ prompt: "Booking ID requiring manager approval" })
  bookingId!: string;

  @Decimal({ prompt: "Total amount in USD requiring approval", min: 0 })
  amountUsd!: number;
}

export class HighValueHoldOutputDto {
  @Text({ prompt: "Approval confirmation token" })
  approvalToken!: string;

  @Flag({ prompt: "Whether hold was approved" })
  approved!: boolean;
}

export class ReviewerVoteDto {
  @Text({ prompt: "Reviewer department (finance | compliance | risk)" })
  department!: string;

  @Flag({ prompt: "Whether the reviewer approves the travel booking" })
  approved!: boolean;

  @Integer({ prompt: "Confidence score from 0 to 100", min: 0, max: 100 })
  confidenceScore!: number;

  @Text({ prompt: "Justification note" })
  rationale!: string;
}
