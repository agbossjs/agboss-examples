/** The carrier refused the order: a real failure after the charge — the saga's undo refunds it (PS10). */
export class CarrierRefusedError extends Error {
  static readonly code = "shipping.carrier-refused";

  constructor(readonly orderId: string) {
    super(`the carrier refused order ${orderId}`);
    this.name = "CarrierRefusedError";
  }
}
