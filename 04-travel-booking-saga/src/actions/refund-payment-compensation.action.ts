import {
  Action,
  type ActionHandler,
  ExecutionContext,
  type InputOf,
} from "@agboss/core";
import { PaymentCaptureDto } from "../dto/payment-capture.dto.js";
import { FakePaymentService } from "../services/fake-payment.service.js";

@Action({
  name: "refund-payment-compensation-action",
  description: "Voids or refunds the captured payment during saga rollback",
  input: { payment: PaymentCaptureDto },
  deps: [FakePaymentService, ExecutionContext],
})
export class RefundPaymentCompensationAction
  implements ActionHandler<RefundPaymentCompensationAction>
{
  constructor(
    private readonly payments: FakePaymentService,
    private readonly executionContext: ExecutionContext,
  ) {}

  async execute(input: InputOf<RefundPaymentCompensationAction>): Promise<void> {
    this.payments.voidOrRefund({
      paymentTransactionId: input.payment.value.paymentTransactionId,
      idempotencyKey: this.executionContext.step.idempotencyKey,
    });
  }
}
