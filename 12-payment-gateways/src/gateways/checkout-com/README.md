# Checkout.com — the right wiring on its official SDK

> **Independent example, not affiliated.** Checkout.com is named only to identify its public API. AGBoss
> is not affiliated with, endorsed by or sponsored by Checkout.com; the name is its owner's trademark.
> This example follows Checkout.com's public documentation as read on 2026-11-01 (https://www.checkout.com/docs/developer-resources/api/idempotency). Gateways
> change their APIs and SDKs: check the official documentation before relying on it.

**Verdict:** Supported — see the [ten gateways](../../../README.md#the-ten-gateways) and
[Payment gateways](https://github.com/agbossjs/agboss/wiki/Payment-gateways#the-ten-gateways) on the Wiki.

- **The SDK:** npm `checkout-sdk-node` pinned at `5.8.0`: `new Checkout(key, { host: <the stub's URL> })` (its README's `host`).
- **The wiring** ([`checkout-com.gateway-payments.ts`](./checkout-com.gateway-payments.ts), about 60 lines): `payments.request(body, idempotencyKey)` under `order:<id>`, `payments.capture(id, { capture_type: "NonFinal" }, key)` under `capture:<payment>:<n>`, `payments.refund(id, body, key)` under `refund:<payment>:<n>`. `reconcile` by `getPaymentList({ reference })`, matching the amount too (a reference is not unique); a capture or a refund by the payment's actions.
- **The stub** ([`stub/`](./stub/)) follows Checkout.com's documented behaviour, each line citing its page: `Cko-Idempotency-Key`, kept 72 h; a repeat replays a **2xx** answer only ("we don't save an idempotent result" for a 4xx or 5xx: a repeat runs again); a concurrent duplicate → `409`; `GET /payments?reference=`; `NonFinal` partial captures.
- **Scenarios run:** ps1, ps5, ps8, ps17 (c), ps18, ps19 — [`tests/gateways/checkout-com.test.ts`](../../../tests/gateways/checkout-com.test.ts).
- **The boundary:** none on this row. A `502` after Checkout.com processed the payment is an error of unknown outcome: the intent stays pending (#657), and the retry past its 72 h reconciles by the reference — one charge (ps17 c).

The SDK and the API may change: the pinned version and the docs read on 2026-11-01 are what this
example follows. Every race and what AGBoss does in it: the full example,
[`11-safe-payments`](../../../../11-safe-payments/), and
[Payments](https://github.com/agbossjs/agboss/wiki/Payments) on the Wiki.

Official documentation: <https://www.checkout.com/docs/developer-resources/api/idempotency>, <https://www.checkout.com/docs/payments/manage-payments/get-a-list-of-payments>, <https://www.checkout.com/docs/payments/manage-payments/capture-a-payment>.
