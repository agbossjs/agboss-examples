import {
  Action,
  type ActionHandler,
  ExecutionContext,
  type InputOf,
  type OutputOf,
} from "agboss";
import { FlightReservationDto } from "../dto/flight-reservation.dto.js";
import { HotelReservationDto } from "../dto/hotel-reservation.dto.js";
import { PaymentCaptureDto } from "../dto/payment-capture.dto.js";
import { TravelBookingRequestDto } from "../dto/travel-booking-request.dto.js";
import { FakePaymentService } from "../services/fake-payment.service.js";
import { RefundPaymentCompensationAction } from "./refund-payment-compensation.action.js";

@Action({
  name: "capture-payment-action",
  description: "Authorizes and captures payment for the reserved flight and hotel",
  input: {
    request: TravelBookingRequestDto,
    flight: FlightReservationDto,
    hotel: HotelReservationDto,
  },
  output: PaymentCaptureDto,
  compensateWith: RefundPaymentCompensationAction,
  deps: [FakePaymentService, ExecutionContext],
})
export class CapturePaymentAction implements ActionHandler<CapturePaymentAction> {
  constructor(
    private readonly payments: FakePaymentService,
    private readonly executionContext: ExecutionContext,
  ) {}

  async execute(input: InputOf<CapturePaymentAction>): Promise<OutputOf<CapturePaymentAction>> {
    void input.flight.value.flightReservationId;
    void input.hotel.value.hotelReservationId;
    const res = this.payments.authorizeAndCapture({
      bookingId: input.request.value.bookingId,
      amountUsd: input.request.value.totalAmountUsd,
      simulateDecline: input.request.value.simulatePaymentDecline,
      idempotencyKey: this.executionContext.step.idempotencyKey,
    });
    return Object.assign(new PaymentCaptureDto(), res);
  }
}
