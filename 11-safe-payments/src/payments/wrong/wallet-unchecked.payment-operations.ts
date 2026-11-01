import { ExecutionContext, Injectable } from "@agboss/core";
import type { StubCharge } from "../../stub/stub-gateway.types.js";
import type { WalletCharge } from "../payment-operations.js";
import { PAYMENT_OPERATIONS_DEPS, RightPaymentOperations } from "../right-payment-operations.js";

/**
 * WRONG (PS9): each branch charges its part on its own — each charge exactly once, under its own
 * business key — and nobody checks the wallet they share: together they exceed it.
 */
@Injectable({ deps: PAYMENT_OPERATIONS_DEPS })
export class WalletUncheckedPaymentOperations extends RightPaymentOperations {
  override chargeWallet(executionContext: ExecutionContext, charge: WalletCharge): Promise<StubCharge> {
    return this.charge(executionContext, {
      orderId: charge.orderId,
      amountCents: charge.amountCents,
      paymentMethod: "card_ok",
      capture: true,
    });
  }
}
