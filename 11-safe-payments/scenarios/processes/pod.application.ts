import { Application, Idempotency, Injectable, TenantContext, type JsonValue } from "@agboss/core";
import { OrderBookRepository } from "../../src/repositories/order-book.repository.js";
import { OrderBookService, type BookingIdentity } from "../../src/services/order-book.service.js";
import { ApprovalInboxChannel } from "../../src/channels/approval-inbox.channel.js";
import { AwaitedOutcomeChannel } from "../../src/channels/awaited-outcome.channel.js";
import { OpenRouterModelProvider } from "../../src/model-providers/openrouter.model-provider.js";
import { SAFE_PAYMENTS_BUDGETS, SAFE_PAYMENTS_PROVIDERS } from "../../src/safe-payments.application.js";
import { SafePaymentsDatabaseStorage } from "../../src/storages/safe-payments.database-storage.js";
import { CheckoutWorkflow } from "../../src/workflows/checkout/checkout.workflow.js";

/**
 * The shop's bookings of a pod, with one seam: before the booking `POD_HOLD_EFFECT` names, the pod
 * tells its driver and waits, forever: the driver `SIGKILL`s it there (PS2: the charge answered,
 * its booking, the step's end, never written).
 */
@Injectable({ deps: [Idempotency, OrderBookRepository, TenantContext] })
export class PodOrderBookService extends OrderBookService {
  override async once<T, F = never>(
    name: string,
    identity: BookingIdentity<F>,
    work: () => (T & JsonValue<T>) | Promise<T & JsonValue<T>>,
  ): Promise<T> {
    if (name === process.env.POD_HOLD_EFFECT) {
      process.send?.({ at: `effect:${name}` });
      await new Promise<never>(() => undefined);
    }
    return super.once(name, identity, work);
  }
}

/** The application as one pod runs it: the checkout on the same stores, the pod's fenced effects. */
@Application({
  name: "safe-payments-application",
  version: "1.0.0",
  storage: SafePaymentsDatabaseStorage,
  modelProvider: OpenRouterModelProvider,
  channels: [ApprovalInboxChannel, AwaitedOutcomeChannel],
  workflows: [CheckoutWorkflow],
  budgets: SAFE_PAYMENTS_BUDGETS,
  providers: [...SAFE_PAYMENTS_PROVIDERS, PodOrderBookService],
})
export class PodApplication {}

// its workflow, for `agboss check --application` on this file (the types it writes are the same)
export { CheckoutWorkflow };
