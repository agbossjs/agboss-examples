import {
  Action,
  type ActionHandler,
  Application,
  Budget,
  BudgetPeriod,
  BudgetScope,
  type BudgetHandler,
  EmptyEnvironment,
  type InputOf,
  type OutputOf,
  Workflow,
  WorkflowFinish,
  WorkflowStart,
  start,
  toAction,
} from "agboss";
import { Integer, Text } from "agboss/dto";
import { usd, type Usd } from "agboss/units";

export class PaymentCaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentCaptureError";
  }
}

export class BookingRequestDto {
  @Text({ prompt: "Booking ID" })
  bookingId!: string;

  @Integer({ prompt: "Amount in cents" })
  amountCents!: number;
}

export class SeatReservationDto {
  @Text({ prompt: "Reservation code" })
  reservationCode!: string;
}

export class PaymentReceiptDto {
  @Text({ prompt: "Capture transaction ID" })
  transactionId!: string;

  @Text({ prompt: "Status" })
  status!: string;
}

@Action({
  name: "release-seat-compensation-broken-action",
  description: "Releases the reserved airline seat during saga rollback",
  input: { reservation: SeatReservationDto },
})
export class ReleaseSeatCompensationAction
  implements ActionHandler<ReleaseSeatCompensationAction>
{
  async execute(input: InputOf<ReleaseSeatCompensationAction>): Promise<void> {
    void input.reservation.value.reservationCode;
  }
}

@Action({
  name: "reserve-seat-broken-action",
  description: "Reserves an airline seat (external side effect requiring compensation on rollback)",
  input: { booking: BookingRequestDto },
  output: SeatReservationDto,
  compensateWith: ReleaseSeatCompensationAction,
})
export class ReserveSeatAction implements ActionHandler<ReserveSeatAction> {
  async execute(input: InputOf<ReserveSeatAction>): Promise<OutputOf<ReserveSeatAction>> {
    return Object.assign(new SeatReservationDto(), {
      reservationCode: `RES-${input.booking.value.bookingId}`,
    });
  }
}

@Action({
  name: "capture-payment-broken-action",
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

@Action({
  name: "format-declined-receipt-broken-action",
  description: "Formats declined receipt on the error side-path without running compensation",
  input: { reservation: SeatReservationDto },
  output: PaymentReceiptDto,
})
export class FormatDeclinedReceiptAction implements ActionHandler<FormatDeclinedReceiptAction> {
  async execute(
    input: InputOf<FormatDeclinedReceiptAction>,
  ): Promise<OutputOf<FormatDeclinedReceiptAction>> {
    return Object.assign(new PaymentReceiptDto(), {
      transactionId: `DECLINED-${input.reservation.value.reservationCode}`,
      status: "DECLINED_WITHOUT_COMPENSATION",
    });
  }
}

@WorkflowStart({
  name: "uncompensated-broken-workflow-start",
  description: "Starts broken uncompensated-action workflow",
  input: BookingRequestDto,
})
export class UncompensatedBrokenStart {}

@WorkflowFinish({
  name: "uncompensated-broken-workflow-finish",
  description: "Finishes broken uncompensated-action workflow",
  output: PaymentReceiptDto,
})
export class UncompensatedBrokenFinish {}

@Workflow({
  name: "uncompensated-broken-workflow",
  version: "0.1.0",
  flow: [
    start(UncompensatedBrokenStart)
      .returns(BookingRequestDto)
      .toAction(ReserveSeatAction)
      .returns(SeatReservationDto)
      .toAction(CapturePaymentAction)
      .onError(
        PaymentCaptureError,
        toAction(FormatDeclinedReceiptAction)
          .returns(PaymentReceiptDto)
          .toFinish(UncompensatedBrokenFinish),
      )
      .returns(PaymentReceiptDto)
      .toFinish(UncompensatedBrokenFinish),
  ],
})
export class UncompensatedBrokenWorkflow {}

@Budget({
  name: "case04-broken-app-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class Case04BrokenAppBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(100);
  }
}

@Budget({
  name: "case04-broken-tenant-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class Case04BrokenTenantBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(20);
  }
}

@Budget({
  name: "case04-broken-exec-budget",
  scope: BudgetScope.Execution,
})
export class Case04BrokenExecBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(5);
  }
}

@Application({
  name: "case-04-uncompensated-action-broken-application",
  version: "0.1.0",
  environment: EmptyEnvironment,
  workflows: [UncompensatedBrokenWorkflow],
  budgets: [Case04BrokenAppBudget, Case04BrokenTenantBudget, Case04BrokenExecBudget],
})
export class UncompensatedBrokenApplication {}
