import type { CheckoutRequestDto } from "../src/dto/checkout-request.dto.js";

/** An order of a scenario: `amountCents` by card, captured now, shipped unless told otherwise. */
export function orderOf(orderId: string, amountCents: number, more: Partial<CheckoutRequestDto> = {}): CheckoutRequestDto {
  return { orderId, amountCents, paymentMethod: "card_ok", capture: true, failShipping: false, restockingFeeCents: 0, ...more };
}
