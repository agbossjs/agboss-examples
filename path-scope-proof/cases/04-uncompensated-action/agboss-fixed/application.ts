import { OfflineNoopModelProvider } from "../../../src/noop-provider.js";
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
  name: "release-seat-compensation-fixed-action",
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
  name: "reserve-seat-fixed-action",
  description: "Reserves an airline seat (external side effect)",
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

@WorkflowStart({
  name: "uncompensated-fixed-workflow-start",
  description: "Starts fixed uncompensated-action workflow",
  input: BookingRequestDto,
})
export class UncompensatedFixedStart {}

@WorkflowFinish({
  name: "uncompensated-fixed-workflow-finish",
  description: "Finishes fixed uncompensated-action workflow",
  output: PaymentReceiptDto,
})
export class UncompensatedFixedFinish {}

@Workflow({
  name: "uncompensated-fixed-workflow",
  version: "0.1.0",
  flow: [
    start(UncompensatedFixedStart)
      .returns(BookingRequestDto)
      .toAction(ReserveSeatAction)
      .returns(SeatReservationDto)
      .toAction(CapturePaymentAction)
      .onError(
        PaymentCaptureError,
        toAction(ReleaseSeatCompensationAction)
          .toAction(FormatDeclinedReceiptAction)
          .returns(PaymentReceiptDto)
          .toFinish(UncompensatedFixedFinish),
      )
      .returns(PaymentReceiptDto)
      .toFinish(UncompensatedFixedFinish),
  ],
})
export class UncompensatedFixedWorkflow {}

@Budget({
  name: "case04-fixed-app-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class Case04FixedAppBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(100);
  }
}

@Budget({
  name: "case04-fixed-tenant-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class Case04FixedTenantBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(20);
  }
}

@Budget({
  name: "case04-fixed-exec-budget",
  scope: BudgetScope.Execution,
})
export class Case04FixedExecBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(5);
  }
}

@Application({
  name: "case-04-uncompensated-action-fixed-application",
  version: "0.1.0",
  environment: EmptyEnvironment,
  workflows: [UncompensatedFixedWorkflow],
  providers: [OfflineNoopModelProvider],
  budgets: [Case04FixedAppBudget, Case04FixedTenantBudget, Case04FixedExecBudget],
})
export class UncompensatedFixedApplication {}
