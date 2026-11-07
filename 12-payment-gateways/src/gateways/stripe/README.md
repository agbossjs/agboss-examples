# Stripe — the right wiring on its official SDK

> **Independent example, not affiliated.** Stripe is named only to identify its public API. AGBoss
> is not affiliated with, endorsed by or sponsored by Stripe; the name is its owner's trademark.
> This example follows Stripe's public documentation as read on 2026-11-01 (https://docs.stripe.com/api/idempotent_requests). Gateways
> change their APIs and SDKs: check the official documentation before relying on it.

**Verdict:** Supported — see the [ten gateways](../../../README.md#the-ten-gateways) and
[Payment gateways](https://github.com/agbossjs/agboss/wiki/Payment-gateways#the-ten-gateways) on the Wiki.

- **The SDK:** npm `stripe` pinned at `23.1.0`: `new Stripe(key, { host, port, protocol: "http" })` (its README's options), `maxNetworkRetries: 0`.
- **The wiring** ([`stripe.gateway-payments.ts`](./stripe.gateway-payments.ts), about 60 lines): `paymentIntents.create(…, { idempotencyKey: call.idempotencyKey })` under `order:<id>`; `refunds.create(…, { idempotencyKey })` under `refund:<payment>:<n>`. `reconcile` searches by `metadata['order_id']`; an empty search is **not** "not sent" — the search lags — so it answers `notSent()` (a replay under the key), and the call declares it a replay with Stripe's retention (`notSent: { trust: NotSentTrust.KeyReplay, keyRetention: hours(24) }`, #658, #795; its refunds, read by `refunds.list`, are `NotSentTrust.Lookup`): past 24 h the replay is refused, `unknown`.
- **The stub** ([`stub/`](./stub/)) follows Stripe's documented behaviour, each line citing its page: Keys "retains … for at least 24 hours" (24 h in the stub); a repeat replays the saved status and body with `Idempotent-Replayed: true`; other parameters → `idempotency_error` (its HTTP status is not documented: 400 in the stub, marked UNVERIFIED); a duplicate still executing → `409`; the search lags (2 minutes in the stub).
- **Scenarios run:** ps1, ps2, ps5, ps8, ps17 (a, b), ps19 — [`tests/gateways/stripe.test.ts`](../../../tests/gateways/stripe.test.ts).
- **The boundary:** none on this row: past 24 h a lost answer that the search cannot find is `unknown`, for a person.

The SDK and the API may change: the pinned version and the docs read on 2026-11-01 are what this
example follows. Every race and what AGBoss does in it: the full example,
[`11-safe-payments`](../../../../11-safe-payments/), and
[Payments](https://github.com/agbossjs/agboss/wiki/Payments) on the Wiki.

Official documentation: <https://docs.stripe.com/api/idempotent_requests>, <https://docs.stripe.com/error-low-level#idempotency>, <https://docs.stripe.com/api/payment_intents/search>.
