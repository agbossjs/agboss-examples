# `travel-booking-saga` — Saga Compensation, Recovery, Idempotency, Quorum & HITL Withdrawal

**Priority:** P0 — Release Readiness  
**Primary Proofs:**
- **Reverse-order Saga Compensation** (`@Action({ compensateWith, committedBy })`) on downstream action errors (`CompensationReason.SidePath`), budget exhaustion (`CompensationReason.ExecutionFailed`), and mid-flight cancellation (`CompensationReason.ExecutionCancelled`).
- **Crash-Resistant Recovery & Idempotency:** Persistent external operation ledgers in `FakeAirlineService`, `FakeHotelService`, and `FakePaymentService` verify that retries and compensation replays keyed by `executionContext.step.idempotencyKey` never double-book, double-charge, or double-refund, and that SQLite-backed executions resume across process restarts.
- **2-of-3 Parallel Quorum Approval:** `.toParallelAgents(...).acceptedBy(BookingQuorumArbiter).joinQuorum({ min: 2, max: 2 })` commits as soon as 2 qualified approvals arrive.
- **HITL Pause Withdrawal (`Channel.withdraw()`):** When a paused branch is superseded by `app.cancel(threadId)` or a sibling `FailFast` failure, AGBoss calls `BookingApprovalChannel.withdraw()` (`PauseResolution.Cancelled` / `PauseResolution.Withdrawn`) and rejects stale `app.resume()` calls with `NotPausedError`.

## Commands

```bash
npm run check
npm test
npm run demo
```
