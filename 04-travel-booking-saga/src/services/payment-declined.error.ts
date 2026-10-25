export class PaymentDeclinedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentDeclinedError";
  }
}
