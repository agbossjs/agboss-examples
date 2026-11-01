# `11-safe-payments` — Every Payment Race, Done Wrong and Done Right

> **Priority:** P0 — a payment charged twice, refunded twice or lost is the one bug a payment system cannot ship
> **Principle:** Promise → Failure Injection → Reproducible Proof

> **Independent example, not affiliated.** The stub gateway here is fictional: it is named only to
> explain the principle, it imitates no real gateway's API or name, and no real gateway is ever
> called. AGBoss is not affiliated with, endorsed by or sponsored by any payment gateway; the
> gateways named on the linked Payments pages are named only to identify their public APIs, and
> their names are their owners' trademarks. Gateways change their APIs and SDKs: check the official
> documentation before relying on anything here.

A shop takes payments through **the stub gateway** — a local HTTP server on `127.0.0.1` with
idempotency keys, a lookup by your reference, a key retention on the scenario's clock, webhooks,
and real failures injected on demand. Every scenario of
[Payment scenarios](https://github.com/agbossjs/agboss/wiki/Payment-scenarios) (PS1–PS23) runs
**twice**: the **wrong** version, which shows the double charge, the double refund or the lost
payment, and the **right** version — the wiring of
[Payments](https://github.com/agbossjs/agboss/wiki/Payments) — which moves the money exactly once.
**Every number is read from the stub's own records** (`stub.ledger()`, `stub.moneyFor(order)`),
never from the application's view or a console line. What a real gateway must offer for this to
hold is on [Payment gateways](https://github.com/agbossjs/agboss/wiki/Payment-gateways); the short
examples on real gateways' SDKs are in [`12-payment-gateways`](../12-payment-gateways/).

```
src/payments/payment-operations.ts        one service for every money-moving call: charge, confirm, capture, settle, void, refund, applyEvent
src/payments/right-payment-operations.ts  the right wiring: an outbound call per operation, a business key, call.idempotencyKey sent, reconcile by lookup
src/payments/wrong/*.ts                   one wrong version per mistake, each overriding the right one (override(PaymentOperations, …))
src/stub/                                 the stub gateway (Full, NoLookup, NoKeys), its faults, its records, its signed webhooks, its client
scenarios/psN-*.scenario.ts               PS1–PS23: the injection, the run, the stub's records → ScenarioOutcome
scenarios/processes/                      PS2 and PS5 on two real `node` processes, the first SIGKILLed
src/your-step/your-payment-operations.ts  a copy of the right wiring for you to edit: npm run check:yours
```

## 1. Engineering Promises Tested

| Promise | Threat / Failure Injected | AGBoss Mechanism | Executable Proof |
|---|---|---|---|
| **A lost answer is never charged again** | The connection drops after the charge (PS1); a crash before the answer (PS5); an SDK error retried (PS22) | `OutboundCalls.send` under a business key: `call.idempotencyKey` the same on every attempt; `reconcile` by your reference | [`tests/scenarios/process-failures.test.ts`](./tests/scenarios/process-failures.test.ts) › "ps1: right — exactly once", › "ps5: right — exactly once" |
| **A crash, a zombie, a takeover charge once** | A holder frozen past its lease (`leases.stall`) and a takeover (PS2–PS4); a real `SIGKILL` (PS2, PS5) | The intent `Completed` → replayed; the lease checked in the write's own transaction (`ExecutionFencedError`) | › "ps2…ps4", [`tests/processes/real-processes.test.ts`](./tests/processes/real-processes.test.ts) |
| **One order, one charge, whoever asks** | The model calls the charge tool four times (PS7); two executions at once (PS8); a deploy that renames the call (PS12); a skewed clock (PS13) | A business key `order:<id>` — `Joined`, `Replayed`, `OutboundCallInFlightError`, `IdempotencyKeyConflictError` | [`tests/scenarios/application-duplicates.test.ts`](./tests/scenarios/application-duplicates.test.ts) |
| **One refund, one capture, one disposition** | A refund whose answer is lost and asked again by another path (PS19); an undo interrupted (PS10); shipment 2 captured twice (PS18); a void racing a capture (PS20) | `refund:<charge>:<n>`, `capture:<charge>:<n>`, `disposition:<charge>`; the undo marked done once (#607) | [`tests/scenarios/gateway-side.test.ts`](./tests/scenarios/gateway-side.test.ts) |
| **A webhook is applied once, by the gateway's current state** | A duplicate delivery on two pods (PS15); events out of order (PS16); a 3DS outcome from three requests (PS21) | A fenced effect under `event:stub:<eventId>`; the pause answered once (`NotPausedError`); the charge's current status read | › "ps15", › "ps16", › "ps21" |
| **What stays the gateway's, and today's boundaries, are named** | A gateway with no lookup or no keys (PS6, PS23); a key past its retention (PS17) | `unknown` → `OutboundCallUnreconciledError` (a person decides); PS17 (c) and (d) asserted as the known boundaries #657 and #658 | › "ps6 …", › "ps17 c: right — today's known boundary #657", › "ps17 d … #658" |
| **The tests bite** | The right version swapped for the wrong one | each right-version assertion run on its wrong version must fail | [`tests/bites.test.ts`](./tests/bites.test.ts) |
| **Your own gateway call can be checked the same way** | A step that forgets the idempotency key on a refund | every right-version assertion with your `PaymentOperations` | [`tests/your-step.test.ts`](./tests/your-step.test.ts) › "a step that forgets the refund key turns ps19 red" |

## 2. The scenarios

Each paragraph says what is injected, what the wrong version does, what the right one does, and
links the scenario on the Wiki. The wrong versions are in [`src/payments/wrong/`](./src/payments/wrong/),
each one class overriding the right wiring; a few of them call the stub without the step's signal,
as most clients do, so a frozen holder's request still goes out when it wakes.

- **PS1 — a retry after a timeout** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps1-a-retry-after-a-timeout)).
  The stub charges, then drops the connection; the customer pays again. Wrong: a new key per
  attempt — two charges. Right: the same business key gives the same `call.idempotencyKey`, and
  the stub replays the first charge.
- **PS2 — a crash after the charge, before the checkpoint** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps2-a-crash-after-the-charge-before-the-checkpoint)).
  Instance 1's charge is answered, and it freezes before the step ends; instance 2 takes the tree
  over and runs the step again. Wrong: a plain client call — two charges. Right: the outbound
  call's intent is `Completed`, its receipt replayed, nothing sent. Also on real processes:
  `SIGKILL` at that point.
- **PS3 — a zombie after a takeover** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps3-a-zombie-after-a-takeover)).
  Instance 1 freezes with its request about to leave; instance 2 takes over and charges; instance
  1 wakes. Wrong: a plain call — two charges. Right: the zombie's request carries the same key
  (G1), its step's signal is aborted once its lease is lost, and its completion is fenced.
- **PS4 — the zombie reaches the write first** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps4-the-zombie-reaches-the-write-first)).
  Both instances are held at their write; the zombie is let go first. Wrong: a homemade
  `fence.assertHeld()` before the call — it passed before the freeze, two charges. Right: the
  outbound-call store checks the lease in the write's own transaction; the zombie's intent is
  refused, and only the new holder sends.
- **PS5 — a crash after the send, before the answer** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps5-a-crash-after-the-send-before-the-answer)).
  The stub charges and holds its answer; instance 1 dies. Wrong: the recovery sends again with a
  new key — two charges. Right: the intent is `Pending`; `reconcile` finds the charge by the
  order's reference (`Reconciled`). Also on real processes: `SIGKILL` while the stub holds the
  answer.
- **PS6 — support levels** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps6-support-levels-full-no-lookup-no-keys)).
  The right wiring, unchanged, on `Full`, `NoLookup` and `NoKeys`, through PS1, PS5 and a retry 25
  hours after a `502`. `Full` charges once; `NoLookup` leaves a lost answer `unknown` (the intent
  waits for a person); `NoKeys` charges twice on a retry: not supported. The late retry charges
  twice on every level today — the boundary #657.
- **PS7 — the model calls the charge tool twice** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps7-the-model-calls-the-charge-tool-twice)).
  A scripted model calls the charge tool twice in one turn, once in the next, and once with
  another amount. Wrong: keyed by the step — four charges. Right: keyed by the order — one charge,
  the rest `Joined` or `Replayed`, the other amount refused (`fenced-effect.key-conflict`).
- **PS8 — two executions for one order** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps8-two-executions-for-one-order)).
  The first's charge is still at the stub when a second execution for the same order starts on
  the other instance. Wrong: step keys — two charges. Right: the second finds the call in flight
  (`OutboundCallInFlightError`: "payment in progress") and sends nothing.
- **PS9 — parallel branches charging one aggregate** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps9-parallel-branches-charging-one-aggregate)).
  Two branches of a split order draw 70.00 each on a wallet of 100.00. Wrong: each branch charges
  on its own — 140.00. Right: each draws on the wallet's row inside a fenced effect, and the row's
  own constraint refuses the second: the aggregate's invariant is the application's.
- **PS10 — a saga's refund interrupted** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps10-a-saga-a-charge-and-its-refund-each-replayed-or-interrupted)).
  The carrier refuses the order; the charge's undo refunds it (less a restocking fee). Instance
  1's refund is answered and it freezes before the undo is marked done. Wrong: the refund is a
  plain call in the undo — two refunds. Right: the refund is an outbound call under
  `refund:<charge>:1`; the undo run again replays it.
- **PS11 — a pause answered twice** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps11-a-pause-answered-twice)).
  A large order waits for the customer's approval; two presses of "approve" reach two instances
  at once. Wrong: the approval handler charges on each press — two charges. Right: both presses
  answer the one pause, which is resolved once; the second gets `NotPausedError`.
- **PS12 — a rolling deploy mid-payment** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps12-a-rolling-deploy-or-a-graceful-stop-mid-payment)).
  Instance 1 is stopped (`app.close()`) with its charge at the stub; it waits for the step, and
  instance 2 finishes the tree; then version 2 pays for the same order. Wrong: version 2 renames
  the call (`charge-v2`) — two charges. Right: the key's text, the name and the request stay the
  same across versions; version 2 replays the charge.
- **PS13 — clock skew** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps13-clock-skew-and-lease-expiry)).
  Instance 2's clock runs 300 s ahead. Wrong: a homemade lock row expiring by each instance's own
  clock — instance 2 thinks it expired, two charges. Right: the lease and the intent are decided
  by the store's clock; instance 2 finds the call in flight.
- **PS14 — the database lost mid-commit** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps14-the-database-lost-mid-commit)).
  The outbound-call store commits the charge's completion, then throws (a store subclass). Wrong:
  "the write failed, so charge again" — two charges. Right: the intent is `Completed`; the
  customer's retry replays it.
- **PS15 — a webhook delivered twice** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps15-a-webhook-delivered-twice)).
  `charge.authorized`, signed, arrives twice at once on two instances, and the shop captures the
  first shipment on it. Wrong: every delivery captures — two captures. Right: the capture is
  keyed `capture:<charge>:1`, the booking `event:stub:<eventId>`; the second delivery is in flight
  or replayed.
- **PS16 — webhooks out of order** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps16-webhooks-out-of-order)).
  A paid and refunded order gets `refund.succeeded` before `charge.succeeded`. Wrong: each payload
  is applied — the order ends "paid" while the stub says refunded. Right: the step reads the
  charge's current status, and the order ends "refunded".
- **PS17 — the key expires before a retry** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps17-the-idempotency-key-expires-before-a-retry)).
  The stub keeps keys 24 h; the repeat comes 25 h later. (a) After a completed charge — wrong:
  a step key, a new charge; right: AGBoss replays its own stored receipt. (b) After a crash before
  the answer — wrong: "replay the key" (`notSent()`), a new charge; right: reconcile by the order's
  reference, which does not expire. (c) After a `502` the stub had processed: today the `Failed`
  intent is resent with no lookup — two charges, **the known boundary
  [#657](https://github.com/agbossjs/agboss/issues/657)**. (d) On a gateway whose only lookup is the
  replay: `notSent()` past the retention — two charges, **the known boundary
  [#658](https://github.com/agbossjs/agboss/issues/658)**. Both are asserted as boundaries, never as
  passing.
- **PS18 — a partial capture** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps18-a-partial-capture)).
  An authorization of 90.00 in three shipments; shipment 2 is captured by two executions. Wrong:
  step keys — shipment 2 captured twice. Right: `capture:<charge>:2` — the second gets the first.
- **PS19 — a refund retried** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps19-a-refund-retried)).
  An operator refunds 20.00 of a 50.00 payment and the answer is lost (the stub refunded); the
  customer's own request for that refund follows. Wrong: a key per path — two refunds. Right: one
  business key for every path, `refund:<charge>:1`; the stub replays the first refund.
- **PS20 — a void and a capture race** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps20-a-void-and-a-capture-race-on-one-authorization)).
  Fulfilment captures an authorization and the customer cancels it. Wrong: both sent; the void is
  refused, the cancel takes it for "cancelled", and the money stays captured, never refunded.
  Right: one `disposition:<charge>` key, the action in the request; the void is the other
  fingerprint (`IdempotencyKeyConflictError`) and the cancel refunds.
- **PS21 — a 3DS flow, the browser retries** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps21-a-redirect-or-3ds-flow-the-browser-retries)).
  The payment form is submitted twice, the return page loads twice, the webhook arrives once.
  Wrong: a new key per submission, and each return page confirms the charge in its query string
  — two charges. Right: one charge under the order's key; every request answers the one pause,
  once; the confirm runs once.
- **PS22 — a retry with another card** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps22-a-retry-with-another-card-after-a-decline)).
  Try 1's answer is lost (it was charged); the customer tries another card. Wrong: a new key per
  try — charged again. Right: another card under the order's key is a conflict, nothing sent, and
  the shop settles try 1 first.
- **PS23 — two requests under one key at once** ([Wiki](https://github.com/agbossjs/agboss/wiki/Payment-scenarios#ps23-two-requests-under-one-key-at-once)).
  Instance 1's request hangs at the stub and instance 1 freezes past its lease; instance 2
  reconciles (nothing processed yet) and sends again, the same key. The right wiring on `Full`:
  `409 in_progress`, then the retry replays — one charge; on `NoKeys`: two. The gateway's side:
  there is no wrong version of the application here.

## 3. Commands

```bash
npm ci
npm run demo                 # every scenario, wrong and right, then one table from the stub's records (.artifacts/report.json)
npm run demo -- --processes  # also PS2 and PS5 on two real processes, SIGKILLed (about a minute each)
npm test                     # every row, the bites, the stub's own behaviour, "check your own gateway call", the real processes
npm run check                # agboss check + tsc + eslint
npm run check:yours          # every scenario's right-version assertion with src/your-step/your-payment-operations.ts
```

All offline and $0: no key, no network beyond `127.0.0.1`, no real gateway. `npm run demo` exits
1 when a row is not as expected.

## 4. Check your own gateway call

1. **Edit `src/your-step/your-payment-operations.ts`** — a copy of the right wiring. Put your
   gateway's SDK call where the stub's client is; keep the business key, `call.idempotencyKey`
   and a `reconcile` that looks the payment up.
2. **Run `npm run check:yours`.** Every scenario's right-version assertion runs with your class
   (`override(PaymentOperations, YourPaymentOperations)`). A refund sent without
   `call.idempotencyKey` turns PS19 red — two refunds in the stub's records
   ([`tests/your-step.test.ts`](./tests/your-step.test.ts) proves it with
   [`tests/fixtures/forgot-refund-key.payment-operations.ts`](./tests/fixtures/forgot-refund-key.payment-operations.ts)).
3. **Copy `src/stub/` into your project** and make it follow your gateway's documentation: its
   key header and retention, its answer to a repeat (the first response, or the current status),
   its conflict, its lookup and its lag, its faults. Keep it current with the docs: AGBoss does not
   ship gateway stubs. [`12-payment-gateways`](../12-payment-gateways/) does this for the supported
   gateways, through their official SDKs.

## 5. Guarantee Boundary

- **The stub's records are the proof.** A wrong version that hid a double charge from the stub
  would make a scenario prove nothing: [`tests/stub/stub-gateway.test.ts`](./tests/stub/stub-gateway.test.ts)
  pins the stub's behaviour level by level, and [`tests/bites.test.ts`](./tests/bites.test.ts)
  makes every right-version assertion fail on its wrong version.
- **What AGBoss guarantees rests on its assumptions** (Wiki → Guarantees, A1–A12): one store
  backend with the leases (here one SQLite file), one `pseudonymKey` on every instance, every
  write inside a step, repeats inside the gateway's retention.
- **Today's boundaries, named:** an error of unknown outcome (a `502` after the gateway charged)
  is resent without a lookup ([#657](https://github.com/agbossjs/agboss/issues/657), PS6 late, PS17
  c), and `reconcile` is not told the attempt's age ([#658](https://github.com/agbossjs/agboss/issues/658),
  PS17 d). Both are asserted as boundaries and flip to guarantees when the core fixes land.
- **What stays the gateway's:** keys on every operation (G1), a lookup (G2), keeping keys long
  enough (G3), its state machine (a void after a capture), signing its webhooks. A gateway without
  keys (`NoKeys`) or a lookup (`NoLookup`) is not supported (PS6, PS23).
- **What stays the application's:** one business key per order, made in one form; routing
  `OutboundCallInFlightError` to "payment in progress"; the aggregate's invariant (PS9); checking a
  webhook's signature and reading the current status (PS15, PS16); stable keys across versions
  (PS12); a lasting "paid" record per order (the `order_bookings` table, PS17); numbering payment
  attempts after a known decline (PS22).
- **Real processes:** PS2 and PS5 also run on two `node` processes on one SQLite file, the first
  `SIGKILL`ed, the second's own recovery sweep finishing the order on real time. PostgreSQL and
  several machines are proven by the core's fault suite and agbossjs/postgres, not here.
