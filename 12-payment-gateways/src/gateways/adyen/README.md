# Adyen — the right wiring on its official SDK

> **Independent example, not affiliated.** Adyen is named only to identify its public API. AGBoss
> is not affiliated with, endorsed by or sponsored by Adyen; the name is its owner's trademark.
> This example follows Adyen's public documentation as read on 2026-11-01 (https://docs.adyen.com/development-resources/api-idempotency). Gateways
> change their APIs and SDKs: check the official documentation before relying on it.

**Verdict:** Supported, for 7 days — see the [ten gateways](../../../README.md#the-ten-gateways) and
[Payment gateways](https://github.com/agbossjs/agboss/wiki/Payment-gateways#the-ten-gateways) on the Wiki.

- **The SDK:** npm `@adyen/api-library` pinned at `32.2.0`: `environment: "TEST"` and a custom `httpClient` (its README: "you can set a custom HttpClient") that sends the library's own request to the stub — `adyen-stub-transport.ts`, not part of the wiring you copy.
- **The wiring** ([`adyen.gateway-payments.ts`](./adyen.gateway-payments.ts), about 60 lines): `PaymentsApi.payments(req, { idempotencyKey })` and `ModificationsApi.refundCapturedPayment(psp, req, { idempotencyKey })`, the key a SHA-256 digest of `call.idempotencyKey` (Adyen takes 64 characters; a digest, never a cut). Adyen has no read API for payments: `reconcile` answers `notSent()` — a replay of the key — and the call declares it a replay with Adyen's retention (`notSent: { trust: NotSentTrust.KeyReplay, keyRetention: hours(7 * 24) }`, #658, #795), so AGBoss sends that replay only while the key is younger than 7 days. The refund's answer only says it was received; its outcome is the `REFUND` webhook, applied once in a fenced effect (`adyen-webhook.receiver.ts`, its HMAC checked with the library's `hmacValidator`). Never drop the key on error 703, as Adyen's page suggests.
- **The stub** ([`stub/`](./stub/)) follows Adyen's documented behaviour, each line citing its page: `idempotency-key`, at most 64 characters; kept 7 days (the documented minimum of "7 to 14 days"); a repeat returns the first response; a duplicate in progress → `422` with code `704` and `transient-error: true`; the `REFUND` webhook, signed, delivered twice.
- **Scenarios run:** ps1, ps5, ps15, ps17 (d), ps19, ps23 — [`tests/gateways/adyen.test.ts`](../../../tests/gateways/adyen.test.ts).
- **The boundary:** past 7 days a lost answer is `unknown`, for a person — Adyen keeps no lookup, and AGBoss refuses the replay (ps17 d, #658).

The SDK and the API may change: the pinned version and the docs read on 2026-11-01 are what this
example follows. Every race and what AGBoss does in it: the full example,
[`11-safe-payments`](../../../../11-safe-payments/), and
[Payments](https://github.com/agbossjs/agboss/wiki/Payments) on the Wiki.

Official documentation: <https://docs.adyen.com/development-resources/api-idempotency>, <https://docs.adyen.com/api-explorer/Checkout/72/overview>, <https://docs.adyen.com/online-payments/refund>.
