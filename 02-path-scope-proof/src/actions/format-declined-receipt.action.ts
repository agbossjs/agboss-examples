import { Action, type ActionHandler, type InputOf, type OutputOf } from "agboss";
import { PaymentReceiptDto } from "../dto/payment-receipt.dto.js";
import { SeatReservationDto } from "../dto/seat-reservation.dto.js";

@Action({
  name: "format-declined-receipt-fixed-action",
  description: "Formats declined receipt after compensation completes",
  input: { reservation: SeatReservationDto },
  output: PaymentReceiptDto,
})
export class FormatDeclinedReceiptAction implements ActionHandler<FormatDeclinedReceiptAction> {
  async execute(
    input: InputOf<FormatDeclinedReceiptAction>,
  ): Promise<OutputOf<FormatDeclinedReceiptAction>> {
    return Object.assign(new PaymentReceiptDto(), {
      transactionId: `COMPENSATED-${input.reservation.value.reservationCode}`,
      status: "COMPENSATED_AND_DECLINED",
    });
  }
}
