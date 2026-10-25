import { Application, EmptyEnvironment } from "agboss";
import { SuiteAppBudget } from "../../../src/budgets/suite-app.budget.js";
import { SuiteExecBudget } from "../../../src/budgets/suite-exec.budget.js";
import { SuiteTenantBudget } from "../../../src/budgets/suite-tenant.budget.js";
import { OfflineNoopModelProvider } from "../../../src/model-providers/offline-noop.model-provider.js";
import { UncompensatedFixedWorkflow } from "../../../src/workflows/uncompensated-fixed.workflow.js";

export { CapturePaymentAction } from "../../../src/actions/capture-payment.action.js";
export { FormatDeclinedReceiptAction } from "../../../src/actions/format-declined-receipt.action.js";
export { PaymentCaptureError } from "../../../src/actions/payment-capture.error.js";
export { ReleaseSeatCompensationAction } from "../../../src/actions/release-seat-compensation.action.js";
export { ReserveSeatAction } from "../../../src/actions/reserve-seat.action.js";
export { BookingRequestDto } from "../../../src/dto/booking-request.dto.js";
export { PaymentReceiptDto } from "../../../src/dto/payment-receipt.dto.js";
export { SeatReservationDto } from "../../../src/dto/seat-reservation.dto.js";
export { UncompensatedFixedFinish } from "../../../src/workflow-finishes/uncompensated-fixed.workflow-finish.js";
export { UncompensatedFixedStart } from "../../../src/workflow-starts/uncompensated-fixed.workflow-start.js";
export { UncompensatedFixedWorkflow } from "../../../src/workflows/uncompensated-fixed.workflow.js";

@Application({
  name: "case-04-uncompensated-action-fixed-application",
  version: "0.1.0",
  environment: EmptyEnvironment,
  workflows: [UncompensatedFixedWorkflow],
  providers: [OfflineNoopModelProvider],
  budgets: [SuiteAppBudget, SuiteTenantBudget, SuiteExecBudget],
})
export class UncompensatedFixedApplication {}
