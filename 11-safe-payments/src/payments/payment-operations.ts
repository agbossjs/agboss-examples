import { Injectable, type ExecutionContext } from "@agboss/core";
import type { StubCharge, StubEvent, StubMovement } from "../stub/stub-gateway.types.js";

/** An order to charge. */
export interface ChargeOrder {
  readonly orderId: string;
  readonly amountCents: number;
  readonly paymentMethod: string;
  /** `false`: authorize only (captured later). */
  readonly capture: boolean;
}

/** One partial capture of an authorization: shipment `shipment` of the order (PS18). */
export interface PartialCapture {
  readonly chargeId: string;
  readonly shipment: number;
  readonly amountCents: number;
}

/** One refund of a payment: the `refundNumber`-th refund of it, whoever asks (PS10, PS19). */
export interface PaymentRefund {
  readonly chargeId: string;
  readonly amountCents: number;
  readonly refundNumber: number;
}

/** What applying a gateway event decided: the order's status and held amount to book (PS15, PS16). */
export interface AppliedEvent {
  readonly orderId: string;
  readonly status: string;
  /** What the gateway holds for the order (captured − refunded), as the event says or as read. */
  readonly heldCents: number;
}

/** One part of a split order, drawn on a wallet and charged (PS9). */
export interface WalletCharge {
  readonly walletId: string;
  readonly orderId: string;
  readonly amountCents: number;
}

/** Thrown when a wallet cannot cover a draw: its row's own constraint refused it (PS9). */
export class WalletInsufficientError extends Error {
  static readonly code = "payments.wallet-insufficient";

  constructor(readonly walletId: string) {
    super(`wallet ${walletId} cannot cover the draw`);
    this.name = "WalletInsufficientError";
  }
}

/** Thrown when the gateway declines a charge: a real failure (its `.onError` or undo runs). */
export class PaymentDeclinedError extends Error {
  static readonly code = "payments.declined";

  constructor(readonly orderId: string) {
    super(`the gateway declined the charge of order ${orderId}`);
    this.name = "PaymentDeclinedError";
  }
}

/**
 * Every operation that moves money, in one service: the only thing the right version
 * (`RightPaymentOperations`, the wiring of Wiki → Payments) and each wrong version
 * (`src/payments/wrong/`) differ in — and what "check your own gateway call" swaps for yours
 * (`src/your-step/your-payment-operations.ts`). Components depend on this class; the application
 * lists one class that extends it.
 */
@Injectable()
export class PaymentOperations {
  /** Charges (or authorizes) an order. */
  charge(executionContext: ExecutionContext, order: ChargeOrder): Promise<StubCharge> {
    return notWired(executionContext, order);
  }

  /** Draws one part of a split order on the customer's wallet and charges it (PS9). */
  chargeWallet(executionContext: ExecutionContext, charge: WalletCharge): Promise<StubCharge> {
    return notWired(executionContext, charge);
  }

  /** Confirms a charge that required an action (the 3DS step, PS21). */
  confirm(executionContext: ExecutionContext, order: ChargeOrder, chargeId: string): Promise<StubCharge> {
    return notWired(executionContext, { order, chargeId });
  }

  /** Captures one shipment of an authorization (PS18). */
  capture(executionContext: ExecutionContext, capture: PartialCapture): Promise<StubMovement> {
    return notWired(executionContext, capture);
  }

  /** Captures a whole authorization: one of its two dispositions (PS20). */
  settle(executionContext: ExecutionContext, chargeId: string, amountCents: number): Promise<StubMovement> {
    return notWired(executionContext, { chargeId, amountCents });
  }

  /** Voids an authorization: its other disposition (PS20). */
  void(executionContext: ExecutionContext, chargeId: string): Promise<StubMovement> {
    return notWired(executionContext, chargeId);
  }

  /** Refunds a payment (PS10, PS19). */
  refund(executionContext: ExecutionContext, refund: PaymentRefund): Promise<StubMovement> {
    return notWired(executionContext, refund);
  }

  /**
   * Applies a gateway event: captures on `charge.authorized` (the first shipment, PS15) and says
   * which status to book (PS16).
   */
  applyEvent(executionContext: ExecutionContext, event: StubEvent): Promise<AppliedEvent> {
    return notWired(executionContext, event);
  }
}

function notWired(executionContext: ExecutionContext, what: unknown): Promise<never> {
  return Promise.reject(
    new Error(
      `PaymentOperations is the contract: list RightPaymentOperations (or yours) in the application ` +
        `(asked by ${executionContext.step.idempotencyKey} for ${JSON.stringify(what)})`,
    ),
  );
}
