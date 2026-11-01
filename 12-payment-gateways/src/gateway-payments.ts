import { Injectable, type ExecutionContext } from "@agboss/core";

/** An order to charge. */
export interface GatewayOrder {
  readonly orderId: string;
  readonly amountCents: number;
  /** `false`: authorize only (captured in shipments later). */
  readonly capture: boolean;
}

/** A payment as the gateway answered it. */
export interface GatewayPayment {
  readonly paymentId: string;
  readonly amountCents: number;
  readonly status: string;
}

/** The `refundNumber`-th refund of a payment (the shop's own numbering, PS19). */
export interface GatewayRefund {
  readonly orderId: string;
  readonly paymentId: string;
  readonly amountCents: number;
  readonly refundNumber: number;
}

/** One shipment of an authorization (PS18). */
export interface GatewayCapture {
  readonly orderId: string;
  readonly paymentId: string;
  readonly shipment: number;
  readonly amountCents: number;
}

/** What the gateway answered a refund or a capture with. */
export interface GatewayMovement {
  readonly movementId: string;
  readonly status: string;
}

/**
 * The money-moving operations of the shop, in one service: each supported gateway's wiring
 * (`src/gateways/<slug>/<slug>.gateway-payments.ts`) extends it. The application lists one; the
 * tests and the demo swap it for each gateway (`override(GatewayPayments, …)`).
 */
@Injectable()
export class GatewayPayments {
  charge(executionContext: ExecutionContext, order: GatewayOrder): Promise<GatewayPayment> {
    return unsupported(executionContext, "charge", order.orderId);
  }

  refund(executionContext: ExecutionContext, refund: GatewayRefund): Promise<GatewayMovement> {
    return unsupported(executionContext, "refund", refund.orderId);
  }

  capture(executionContext: ExecutionContext, capture: GatewayCapture): Promise<GatewayMovement> {
    return unsupported(executionContext, "capture", capture.orderId);
  }
}

function unsupported(executionContext: ExecutionContext, operation: string, orderId: string): Promise<never> {
  return Promise.reject(
    new Error(`this gateway's wiring has no ${operation} (order ${orderId}, step ${executionContext.step.idempotencyKey})`),
  );
}
