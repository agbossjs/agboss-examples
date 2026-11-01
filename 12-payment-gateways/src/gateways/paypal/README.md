# PayPal — the right wiring on its official SDK

> **Independent example, not affiliated.** PayPal is named only to identify its public API. AGBoss
> is not affiliated with, endorsed by or sponsored by PayPal; the name is its owner's trademark.
> This example follows PayPal's public documentation as read on 2026-11-01 (https://developer.paypal.com/api/rest/reference/idempotency/). Gateways
> change their APIs and SDKs: check the official documentation before relying on it.

**Verdict:** Supported — see the [ten gateways](../../../README.md#the-ten-gateways) and
[Payment gateways](https://github.com/agbossjs/agboss/wiki/Payment-gateways#the-ten-gateways) on the Wiki.

- **The SDK:** npm `@paypal/paypal-server-sdk` pinned at `2.5.0`. It has no base URL option (production and sandbox only), so its `httpClientOptions.httpsAgent` opens every TLS connection to the stub on 127.0.0.1, under a certificate generated when the test starts (`selfsigned`, a dev dependency; no key committed) — `paypal-stub-transport.ts`, not part of the wiring you copy. A test checks the agent connects to 127.0.0.1 only.
- **The wiring** ([`paypal.gateway-payments.ts`](./paypal.gateway-payments.ts), about 60 lines): Create the order (`paypalRequestId`) under `order:<id>` — no money moves there — then capture it (`paypalRequestId`) under the same business key, a call of its own; the PayPal order id exists before money moves, so `reconcile` reads the order (`getOrder`) and finds its capture. Refunds: `refundCapturedPayment` under `refund:<order>:<n>`, reconciled by the order's refunds.
- **The stub** ([`stub/`](./stub/)) follows PayPal's documented behaviour, each line citing its page: `PayPal-Request-Id`; a repeat returns the **current** status, not the first answer; Orders keep the id 6 h (stated in PayPal's GitHub spec and the SDK's docstring only, not the live site); a second capture under another id → `422 ORDER_ALREADY_CAPTURED`; a concurrent refund → `409 PREVIOUS_REQUEST_IN_PROGRESS`.
- **Scenarios run:** ps1, ps5, ps8, ps17 (b), ps19 — [`tests/gateways/paypal.test.ts`](../../../tests/gateways/paypal.test.ts).
- **The boundary:** Payments v2's key retention is not documented (6 h in the stub, UNVERIFIED).

The SDK and the API may change: the pinned version and the docs read on 2026-11-01 are what this
example follows. Every race and what AGBoss does in it: the full example,
[`11-safe-payments`](../../../../11-safe-payments/), and
[Payments](https://github.com/agbossjs/agboss/wiki/Payments) on the Wiki.

Official documentation: <https://developer.paypal.com/api/rest/reference/idempotency/>, <https://developer.paypal.com/docs/api/orders/v2/>.
