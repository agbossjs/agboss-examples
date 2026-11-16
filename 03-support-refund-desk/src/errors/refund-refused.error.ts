/** Why a refund was refused before any money moved. */
export type RefundRefusal = "unknown-order" | "other-tenant" | "amount-invalid" | "amount-over-order";

/** A refund the desk refuses: the order is not this tenant's, the amount is not the order's to give back. */
export class RefundRefusedError extends Error {
  static readonly code = "refund.refused" as const;
  readonly code = RefundRefusedError.code;
  override name = "RefundRefusedError";

  constructor(
    readonly refusal: RefundRefusal,
    readonly orderId: string,
  ) {
    super(`refund of ${orderId} refused: ${refusal}`);
  }
}
