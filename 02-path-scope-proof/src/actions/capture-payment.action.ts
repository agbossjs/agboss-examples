import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { BookingRequestDto } from "../dto/booking-request.dto.js";
import { PaymentReceiptDto } from "../dto/payment-receipt.dto.js";
import { SeatReservationDto } from "../dto/seat-reservation.dto.js";
import { PaymentCaptureError } from "./payment-capture.error.js";

@Action({
  name: "capture-payment-fixed-action",
  description: "Captures payment, throwing PaymentCaptureError when declined",
  input: {
    booking: BookingRequestDto,
    reservation: SeatReservationDto,
  },
  output: PaymentReceiptDto,
})
export class CapturePaymentAction implements ActionHandler<CapturePaymentAction> {
  async execute(input: InputOf<CapturePaymentAction>): Promise<OutputOf<CapturePaymentAction>> {
    if (input.booking.value.amountCents > 50_000) {
      throw new PaymentCaptureError("Card declined for amount > $500");
    }
    return Object.assign(new PaymentReceiptDto(), {
      transactionId: `TX-${input.reservation.value.reservationCode}`,
      status: "CAPTURED",
    });
  }
}
