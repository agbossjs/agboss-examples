# `04-travel-booking-saga` — Saga Compensation, Recovery, Idempotency, Quorum, HITL Withdrawal & HTTP Server

**Priority:** P0 — Release Readiness  
**Primary Proofs:**
- **Reverse-order Saga Compensation** (`@Action({ compensateWith, committedBy })`) on downstream action errors (`CompensationReason.SidePath`), budget exhaustion (`CompensationReason.ExecutionFailed`), and mid-flight cancellation (`CompensationReason.ExecutionCancelled`).
- **Crash-Resistant Recovery & Idempotency:** Persistent external operation ledgers in `FakeAirlineService`, `FakeHotelService`, and `FakePaymentService` verify that retries and compensation replays keyed by `executionContext.step.idempotencyKey` never double-book, double-charge, or double-refund, and that SQLite-backed executions resume across process restarts.
- **2-of-3 Parallel Quorum Approval:** `.toParallelAgents(...).acceptedBy(BookingQuorumArbiter).joinQuorum({ min: 2, max: 2 })` commits as soon as 2 qualified approvals arrive.
- **HITL Pause Withdrawal (`Channel.withdraw()`):** When a paused branch is superseded by `app.cancel(threadId)` or a sibling `FailFast` failure, AGBoss calls `BookingApprovalChannel.withdraw()` (`PauseResolution.Cancelled` / `PauseResolution.Withdrawn`) and rejects stale `app.resume()` calls with `NotPausedError`.
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
