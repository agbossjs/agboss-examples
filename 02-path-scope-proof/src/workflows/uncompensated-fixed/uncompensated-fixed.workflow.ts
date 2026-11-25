import { Workflow, toAction, onStart, Ttl } from "@agboss/core";
import { CapturePaymentAction } from "../../actions/capture-payment.action.js";
import { FormatDeclinedReceiptAction } from "../../actions/format-declined-receipt.action.js";
import { PaymentCaptureError } from "../../actions/payment-capture.error.js";
import { ReleaseSeatCompensationAction } from "../../actions/release-seat-compensation.action.js";
import { ReserveSeatAction } from "../../actions/reserve-seat.action.js";
import { BookingRequestDto } from "../../dto/booking-request.dto.js";
import { PaymentReceiptDto } from "../../dto/payment-receipt.dto.js";
import { SeatReservationDto } from "../../dto/seat-reservation.dto.js";
import { UncompensatedFixedFinish } from "./uncompensated-fixed.workflow-finish.js";
import { UncompensatedFixedStart } from "./uncompensated-fixed.workflow-start.js";

@Workflow({
  name: "uncompensated-fixed-workflow",
  version: "0.1.0",
  historyTtl: Ttl.Forever,
  flow: [
    onStart(UncompensatedFixedStart)
      .toAction(ReserveSeatAction)
      .toAction(CapturePaymentAction)
      .onError(
        PaymentCaptureError,
        toAction(ReleaseSeatCompensationAction)
          .toAction(FormatDeclinedReceiptAction)
          .toFinish(UncompensatedFixedFinish),
      )
      .toFinish(UncompensatedFixedFinish),
  ],
})
export class UncompensatedFixedWorkflow {}
