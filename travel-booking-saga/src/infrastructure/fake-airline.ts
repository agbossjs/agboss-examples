import { Injectable } from "agboss";
import {
  recordIdempotentOperation,
  shouldFailCancelOnce,
} from "./operation-ledger.js";

export class AirlineCompensationCrashError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AirlineCompensationCrashError";
  }
}

export interface AirlineReservationResult {
  readonly bookingId: string;
  readonly flightReservationId: string;
  readonly seatHoldCode: string;
}

@Injectable()
export class FakeAirlineService {
  reserveSeat(params: {
    readonly bookingId: string;
    readonly flightCode: string;
    readonly idempotencyKey: string;
  }): AirlineReservationResult {
    const flightReservationId = `FLIGHT-${params.bookingId}`;
    return recordIdempotentOperation({
      service: "airline",
      operation: "reserve",
      resourceId: flightReservationId,
      idempotencyKey: params.idempotencyKey,
      nextResourceState: "RESERVED",
      computeResult: () => ({
        bookingId: params.bookingId,
        flightReservationId,
        seatHoldCode: `SEAT-${params.flightCode}-${params.bookingId}`,
      }),
    });
  }

  releaseSeat(params: {
    readonly bookingId: string;
    readonly flightReservationId: string;
    readonly idempotencyKey: string;
  }): void {
    if (shouldFailCancelOnce(params.bookingId)) {
      throw new AirlineCompensationCrashError(
        `Transient airline release outage for ${params.flightReservationId}`,
      );
    }
    recordIdempotentOperation({
      service: "airline",
      operation: "release",
      resourceId: params.flightReservationId,
      idempotencyKey: params.idempotencyKey,
      nextResourceState: "RELEASED",
      computeResult: () => undefined,
    });
  }

  confirmSeat(params: {
    readonly flightReservationId: string;
    readonly idempotencyKey: string;
  }): void {
    recordIdempotentOperation({
      service: "airline",
      operation: "confirm",
      resourceId: params.flightReservationId,
      idempotencyKey: params.idempotencyKey,
      nextResourceState: "CONFIRMED",
      computeResult: () => undefined,
    });
  }
}
