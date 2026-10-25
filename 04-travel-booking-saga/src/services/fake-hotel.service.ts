import { Injectable } from "agboss";
import { recordIdempotentOperation } from "./operation-ledger.service.js";

export interface HotelReservationResult {
  readonly bookingId: string;
  readonly hotelReservationId: string;
  readonly roomHoldCode: string;
}

@Injectable()
export class FakeHotelService {
  reserveRoom(params: {
    readonly bookingId: string;
    readonly hotelCode: string;
    readonly idempotencyKey: string;
  }): HotelReservationResult {
    const hotelReservationId = `HOTEL-${params.bookingId}`;
    return recordIdempotentOperation({
      service: "hotel",
      operation: "reserve",
      resourceId: hotelReservationId,
      idempotencyKey: params.idempotencyKey,
      nextResourceState: "RESERVED",
      computeResult: () => ({
        bookingId: params.bookingId,
        hotelReservationId,
        roomHoldCode: `ROOM-${params.hotelCode}-${params.bookingId}`,
      }),
    });
  }

  releaseRoom(params: {
    readonly bookingId: string;
    readonly hotelReservationId: string;
    readonly idempotencyKey: string;
  }): void {
    recordIdempotentOperation({
      service: "hotel",
      operation: "release",
      resourceId: params.hotelReservationId,
      idempotencyKey: params.idempotencyKey,
      nextResourceState: "RELEASED",
      computeResult: () => undefined,
    });
  }

  confirmRoom(params: {
    readonly hotelReservationId: string;
    readonly idempotencyKey: string;
  }): void {
    recordIdempotentOperation({
      service: "hotel",
      operation: "confirm",
      resourceId: params.hotelReservationId,
      idempotencyKey: params.idempotencyKey,
      nextResourceState: "CONFIRMED",
      computeResult: () => undefined,
    });
  }
}
