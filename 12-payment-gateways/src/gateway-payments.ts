import { Injectable } from "@agboss/core";
import { hours, seconds } from "@agboss/core/units";

/** What every wiring's call is bound by: one attempt at most 20 s, its rows kept 48 h (over the shortest key retention, Stripe's 24 h). */
export const CALL_BOUNDS = { timeout: seconds(20), ttl: hours(48) } as const;

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
 * tests and the demo swap it for each gateway (`services: [<Slug>GatewayPayments]` of `testWith`).
 */
@Injectable()
export class GatewayPayments {
  charge(order: GatewayOrder): Promise<GatewayPayment> {
    return unsupported("charge", order.orderId);
  }

  refund(refund: GatewayRefund): Promise<GatewayMovement> {
    return unsupported("refund", refund.orderId);
  }

  capture(capture: GatewayCapture): Promise<GatewayMovement> {
    return unsupported("capture", capture.orderId);
  }
}

function unsupported(operation: string, orderId: string): Promise<never> {
  return Promise.reject(
    new Error(`this gateway's wiring has no ${operation} (order ${orderId})`),
  );
}
