# CardCom — the right wiring on its official SDK

> **Independent example, not affiliated.** CardCom is named only to identify its public API. AGBoss
> is not affiliated with, endorsed by or sponsored by CardCom; the name is its owner's trademark.
> This example follows CardCom's public documentation as read on 2026-11-01 (https://secure.cardcom.solutions/api/v11/docs). Gateways
> change their APIs and SDKs: check the official documentation before relying on it.

**Verdict:** Supported, for charges — see the [ten gateways](../../../README.md#the-ten-gateways) and
[Payment gateways](https://github.com/agbossjs/agboss/wiki/Payment-gateways#the-ten-gateways) on the Wiki.

- **The SDK:** CardCom has no official Node SDK: its documented HTTP API v11, by `fetch`.
- **The wiring** ([`cardcom.gateway-payments.ts`](./cardcom.gateway-payments.ts), about 60 lines): `Transactions/Transaction` (Do Transaction) with `ExternalUniqTranId` = the first 25 characters of the base64url SHA-256 of `call.idempotencyKey` (150 bits; CardCom takes 25 characters) and `ExternalUniqUniqTranIdResponse: true`, so a repeat returns the original answer; `reconcile` by `Transactions/GetTransactionByExternalUniqTran`. Refunds (`RefundByTransactionId`) take **no key**: sent through an outbound call all the same (AGBoss never resends one blindly), their `reconcile` answers `unknown` — a person decides.
- **The stub** ([`stub/`](./stub/)) follows CardCom's documented behaviour, each line citing its page: `ExternalUniqTranId`, at most 25 characters; with `ExternalUniqUniqTranIdResponse: true` the original answer (else error 608); a failed attempt does not use the id up; no protection of a concurrent duplicate (KB 509: "wait … up to 7 seconds"); refunds unkeyed.
- **Scenarios run:** ps1, ps5, ps8, ps19, ps23 — [`tests/gateways/cardcom.test.ts`](../../../tests/gateways/cardcom.test.ts).
- **The boundary:** a refund whose answer is lost is resent today (#657: a `Failed` intent is resent without a lookup) — two refunds (ps19); once #657 lands it stays `unknown`, one refund. Two requests under one id at once both charge (ps23): CardCom's own gap.

The SDK and the API may change: the pinned version and the docs read on 2026-11-01 are what this
example follows. Every race and what AGBoss does in it: the full example,
[`11-safe-payments`](../../../../11-safe-payments/), and
[Payments](https://github.com/agbossjs/agboss/wiki/Payments) on the Wiki.

Official documentation: <https://secure.cardcom.solutions/api/v11/docs>, <https://kb.cardcom.solutions/apijosn/he/articles/508/do-transaction-token-charge-direct-interface>, <https://kb.cardcom.solutions/apijosn/he/articles/509/prevent-duplicate-token-transactions>.
