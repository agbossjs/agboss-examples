export class AirlineCompensationCrashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AirlineCompensationCrashError";
  }
}
