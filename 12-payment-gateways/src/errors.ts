/** The carrier refused the order: the charge's undo refunds it. */
export class CarrierRefusedError extends Error {
  static readonly code = "shipping.carrier-refused";

  constructor(readonly orderId: string) {
    super(`the carrier refused order ${orderId}`);
    this.name = "CarrierRefusedError";
  }
}
