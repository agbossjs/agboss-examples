export class PaymentCaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentCaptureError";
  }
}
