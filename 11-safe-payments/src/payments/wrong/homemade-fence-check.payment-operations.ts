import { ExecutionContext, Injectable } from "@agboss/core";
import type { StubCharge } from "../../stub/stub-gateway.types.js";
import { OrderBookRepository } from "../../repositories/order-book.repository.js";
import { OrderBookService } from "../../services/order-book.service.js";
import { StubGatewayService } from "../../services/stub-gateway.service.js";
import type { ChargeOrder } from "../payment-operations.js";
import { RightPaymentOperations } from "../right-payment-operations.js";
import { chargeRequestOf } from "./new-key-per-attempt.payment-operations.js";
import { Idempotency } from "@agboss/core";

/**
 * WRONG (PS4): a homemade check — `signal.throwIfAborted()`, "is my step still current?" — and then the call, in a second step of its
 * own. Between the two the holder can freeze, lose its lease and wake up: the check passed, the
 * call goes out anyway (a time-of-check to time-of-use gap).
 */
@Injectable({ deps: [Idempotency, StubGatewayService, OrderBookService, OrderBookRepository, ExecutionContext] })
export class HomemadeFenceCheckPaymentOperations extends RightPaymentOperations {
  constructor(
    idempotency: Idempotency,
    stubGatewayService: StubGatewayService,
    orderBookService: OrderBookService,
    orderBookRepository: OrderBookRepository,
    private readonly executionContext: ExecutionContext,
  ) {
    super(idempotency, stubGatewayService, orderBookService, orderBookRepository);
  }

  override charge(order: ChargeOrder): Promise<StubCharge> {
    this.executionContext.signal.throwIfAborted();
    return this.stubGatewayService.client().createCharge(chargeRequestOf(order));
  }
}
