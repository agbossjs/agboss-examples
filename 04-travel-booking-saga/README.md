# `04-travel-booking-saga` — Saga Compensation, Recovery, Idempotency, Quorum, Closed Approval Messages & HTTP Server

**Priority:** P0 — Release Readiness  
**Primary Proofs:**
- **Reverse-order Saga Compensation** (`@Action({ compensateWith, committedBy })`) on downstream action errors (`CompensationReason.SidePath`), budget exhaustion (`CompensationReason.ExecutionFailed`), and mid-flight cancellation (`CompensationReason.ExecutionCancelled`).
- **Crash-Resistant Recovery & Idempotency:** Persistent external operation ledgers in `FakeAirlineService`, `FakeHotelService`, and `FakePaymentService` verify that retries and compensation replays keyed by `executionContext.step.idempotencyKey` never double-book, double-charge, or double-refund, and that SQLite-backed executions resume across process restarts.
- **2-of-3 Parallel Quorum Approval:** `.inParallel([...]).arbitratedBy(BookingQuorumArbiter).joinQuorum({ min: 2, max: 2 })` commits as soon as 2 qualified approvals arrive.
- **A closed pause closes its approval message (`onPauseClosed`):** `CorporateBookingApprovalChannel` is told, at least once and deduplicated by `event.deliveryId`, whenever a pause it sent closes — `app.cancel(threadId)` (`PauseClosedReason.Cancelled`), a decided quorum or a `FailFast` sibling (`PauseClosedReason.Withdrawn`), an answer, an expiry — so the message loses its buttons exactly once. A stale `app.resume()` is refused with `PauseClosedError` carrying the same `reason` (`scenarios/pause-closed.ts`). 0.1.0's `Channel.withdraw()` is gone ([Upgrading to 0.1.1](https://github.com/agbossjs/agboss/wiki/Upgrading-to-0.1.1)).
- **An open approval moves to a deputy (`app.reassignPause`, `app.extendPause`):** the travel manager is away, so the desk first gives the question more time (`extendPause`, the `@ToolApproval` has `timeout: hours(4)`), then moves it: `reassignPause({ pauseId, channel: DeputyBookingApprovalChannel, assignees: ["deputy"] }, { actor })`. The agent and the reservations do not run again; the channel is sent again with a new `pauseId`, `ChannelAsk.assignees` and `ChannelAsk.replaces`, and told `onPauseClosed` with `PauseClosedReason.Reassigned` for the old message; the old id is refused with `PauseClosedError` (`reason: reassigned`); the new id is a capability — the call returns only its key, and the replacement keeps the extended deadline; the deputy approves and the saga completes with one flight and one hotel (`scenarios/manager-away-reassign.ts`, [`tests/workflows/payment-saga/payment-saga.workflow.test.ts`](./tests/workflows/payment-saga/payment-saga.workflow.test.ts) › "Scenario G").
- **Production HTTP Adapter (`src/http/server.ts`):** Demonstrates `POST /api/bookings/hold` returning `202 Accepted` `{ status: "paused", threadId, pauseId, pending }`, `POST /api/pauses/:pauseId/resume`, `POST /api/threads/:threadId/cancel`, `/health/live`, `/health/ready`, and graceful shutdown (`await app.close()`).

## Canonical `src/` & Symmetric `tests/` Layout

- `src/workflows/payment-saga/` — `payment-saga.workflow.ts`, `payment-saga.workflow-start.ts`, `payment-saga.workflow-finish.ts`
- `src/workflows/budget-saga/` — `budget-saga.workflow.ts`, `budget-saga.workflow-start.ts`, `budget-saga.workflow-finish.ts`
- `src/workflows/quorum-saga/` — `quorum-saga.workflow.ts`, `quorum-saga.workflow-start.ts`, `quorum-saga.workflow-finish.ts`
- `src/workflows/hitl-hold-saga/` — `hitl-hold-saga.workflow.ts`, `hitl-hold-saga.workflow-start.ts`, `hitl-hold-saga.workflow-finish.ts`
- `src/http/server.ts` — Node HTTP server wrapping `createApp(TravelBookingSagaApplication)`
- `tests/` — Mirrors `src/`:
  - `tests/actions/reserve-flight.action.test.ts`
  - `tests/http/server.test.ts`
  - `tests/workflows/payment-saga/payment-saga.workflow.test.ts`

## Commands

```bash
npm run check
npm test
npm run demo
```

## Guarantee Boundary

AGBoss guarantees static compensation coverage checking (`[flow.uncompensated-action]`), reverse-order LIFO compensation dispatch on downstream failure/cancellation/budget cutoff, and deterministic `executionContext.step.idempotencyKey` propagation to every `@Action` and `@Tool`. End-to-end idempotency of external side effects (such as preventing duplicate airline reservations or payment captures across network retries) relies on the external service or downstream ledger honoring the passed `idempotencyKey`.

## The 0.1.1 shape of this example

- The booking approval is a `@ToolApproval` (`BookingApprovalToolApproval`: `respondent: PauseRespondent.Delegate`, `timeout: hours(4)`)
  named by the tool (`approval:`), and two `@Channel({ target, ttl })` classes carry it: the travel manager's and the deputy's
  (`app.reassignPause({ channel })` moves an open approval across them); a `@ChannelSelector` picks the manager's for a new one.
- The quorum is `.inParallel([...]).arbitratedBy(BookingQuorumArbiter).joinQuorum({ min, max, deadline })`; the arbiter's
  methods are `@Arbitrate(Agent)`. A saga step that is an action counts as a step: `executionLimits.maxSteps` is set where
  the worst path is longer than the 0.1.0 default.
- The model provider is explicit (`SagaOfflineModelProvider` is the application's `modelProvider`); the rows go to
  `TravelSagaDatabaseStorage` (`@DatabaseStorage` on `SqliteDriver`, the PII key via `defineEnv`); the HTTP server names the
  tenant (`default`) in `resume` and `cancel`.
- The demo lives in `src/scripts/`, which `agboss check` does not load.
