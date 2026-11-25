# `05-cluster-work-stealing` — Distributed Scheduling, Leases, Fencing & Backpressure

> **Priority:** P1 — Distributed Cluster Scheduling & Fault Recovery Proof  
> **Principle:** Promise → Failure Injection → Reproducible Proof

## 1. Engineering Promises Tested

| Promise | Threat / Failure Injected | AGBoss Mechanism | Executable Proof |
|---|---|---|---|
| **Distributed work stealing & bounded recursion** | Single worker bottleneck or unbounded recursive fan-out (`toWorkflow(() => Self)`) | `.forEachItem(toWorkflow(ChunkWorkerWorkflow), { takeFirst, maxConcurrency })` with `@Workflow({ placement: ChildPlacement.AnyWorker })` on the child, the `@DatabaseStorage` that builds the child queue, `toWorkflow(() => Self)` + `executionLimits.maxDepth: 2` | [`tests/workflows/coordinator/coordinator.workflow.test.ts`](./tests/workflows/coordinator/coordinator.workflow.test.ts) |
| **30s execution leases, fencing & idempotent recovery** | Instance 1 stalls beyond the 30s lease and attempts to write after Instance 2 takes over | `SqliteExecutionLeaseRepository`, `ExecutionLeaseLostError` (`execution.lease-lost`) | [`tests/workflows/coordinator/coordinator.workflow.test.ts`](./tests/workflows/coordinator/coordinator.workflow.test.ts) |
| **One commit per chunk, whoever commits it** | A step run again after a crash, the same chunk handed to a second worker on the other instance, or a zombie whose lease was taken over reaching the commit | A fenced effect (`Idempotency.runOnce({ key: "chunk:<chunkId>", withoutFingerprint: true, … })` on the fenced-effect store of the `@DatabaseStorage`, the ledger writing through `SqliteConnection.requireTransaction()`): the ledger's row and the stored result in one SQLite transaction, checked against the lease — the replay gets the first commit, the zombie `ExecutionError.Fenced` | [`tests/actions/commit-chunk-effect.action.test.ts`](./tests/actions/commit-chunk-effect.action.test.ts), [`tests/workflows/coordinator/coordinator.workflow.test.ts`](./tests/workflows/coordinator/coordinator.workflow.test.ts) › "one commit per chunk across the cluster" |
| **Step-slot backpressure & Kubernetes health probes** | Burst traffic saturates `maxConcurrentSteps: 2` or storage latency spikes | `@Application({ executionLimits: { maxConcurrentSteps: 2 }, healthChecks })`, `HealthReport.isBusy` on a full instance, `@HealthCheck` (`app.checkLiveness()` / `app.checkReadiness()`) | [`tests/health-checks/storage-cluster.health-check.test.ts`](./tests/health-checks/storage-cluster.health-check.test.ts) |
| **Cross-instance pause/resume/cancel & version guard** | Pause created on Instance 1 is answered/cancelled on Instance 2, or resumed after a breaking workflow version deploy | `SqlitePausedExecutionRepository`, `SqliteExecutionTreeRepository`, `IncompatibleResumeError` (`resume.incompatible`), `WorkflowSettings.builder().onIncompatibleResume(...)` | [`tests/workflows/coordinator/coordinator.workflow.test.ts`](./tests/workflows/coordinator/coordinator.workflow.test.ts) |

## 2. Canonical `src/` & Symmetric `tests/` Layout

- [`src/workflows/coordinator/`](./src/workflows/coordinator/) — `coordinator.workflow.ts`, `coordinator.workflow-start.ts`, `coordinator.workflow-finish.ts`.
- [`src/workflows/chunk-worker/`](./src/workflows/chunk-worker/) — `chunk-worker.workflow.ts`, `chunk-worker.workflow-start.ts`, `chunk-worker.workflow-finish.ts`, `chunk-failed.workflow-finish.ts`.
- [`src/workflows/recursive-decomposer/`](./src/workflows/recursive-decomposer/) — `recursive-decomposer.workflow.ts`, `recursive-decomposer.workflow-start.ts`, `recursive-decomposer.workflow-finish.ts`, `recursive-decomposer-failed.workflow-finish.ts`.
- [`src/actions/commit-chunk-effect.action.ts`](./src/actions/commit-chunk-effect.action.ts) & [`src/repositories/chunk-ledger.repository.ts`](./src/repositories/chunk-ledger.repository.ts) — the chunk's commit as a fenced effect (#500) on the shared SQLite file: no idempotency or fencing table of the example's own.
- [`src/health-checks/storage-cluster.health-check.ts`](./src/health-checks/storage-cluster.health-check.ts) — the `@HealthCheck` probe.
- `tests/` — Mirrors `src/`:
  - [`tests/actions/partition-batch.action.test.ts`](./tests/actions/partition-batch.action.test.ts)
  - [`tests/actions/commit-chunk-effect.action.test.ts`](./tests/actions/commit-chunk-effect.action.test.ts)
  - [`tests/health-checks/storage-cluster.health-check.test.ts`](./tests/health-checks/storage-cluster.health-check.test.ts)
  - [`tests/workflows/coordinator/coordinator.workflow.test.ts`](./tests/workflows/coordinator/coordinator.workflow.test.ts) (including `studioOf` from `@agboss/core/testing` + `getGraphAsync({ xray: true })` subgraph & recursive-workflow verification; skipped on 0.1.1, see below)

## 3. Commands

```bash
npm run check   # Run agboss check + TypeScript + ESLint
npm test        # Run all distributed cluster & isolated component proof suites
npm run demo    # Run deterministic offline cluster demo
```

## 4. Guarantee Boundary (Two-Process SQLite vs Multi-Host Deployment)

The tests in this example (`testWith(ClusterWorkStealingApplication, { instances: 2 })`) verify two application instances coordinating over a shared local SQLite WAL file (`SqliteExecutionLeaseRepository`, `SqliteChildExecutionQueueRepository`, `SqliteCheckpointSaver`, `SqlitePausedExecutionRepository`) on a single machine. For multi-host distributed deployments across separate machines or pods without shared local disk, applications must provide repository implementations backed by a networked transactional store (such as PostgreSQL or Redis) that satisfy the same AGBoss repository contracts.

## The 0.1.1 shape of this example

- Every instance shares one SQLite file: `ClusterDatabaseStorage` (`@DatabaseStorage`, `SqliteDriver({ path: SQLITE_PATH })`)
  builds the leases, the child queue, the pauses and the fenced-effect store; its idempotency and PII keys are read through `defineEnv`.
  The multi-instance tests give each test a file of its own (`tests/support/instances-file.ts` sets `SQLITE_PATH`).
- The chunk is committed through `Idempotency.runOnce` (key `chunk:<chunkId>`, `withoutFingerprint: true`: a second worker's
  summary replays the first commit); `ChunkLedgerRepository` takes `SqliteConnection` from `@agboss/core/stores` and writes in
  the effect's transaction.
- `CoordinatorWorkflow` fans out with `.forEachItem(toWorkflow(ChunkWorkerWorkflow), { takeFirst, maxConcurrency })`; the child
  says where it runs (`@Workflow({ placement: ChildPlacement.AnyWorker })`). The recursion is `toWorkflow(() => Self)` with
  `executionLimits: { maxDepth, maxConcurrency }`, the split is `.toOneOf([…])`, and the join reads `listOf(A, B)`.
- The sign-off is a `@ToolApproval` (`respondent: PauseRespondent.Owner`) with a `@Channel({ target, ttl })`.
- Left: the Studio test (`studioOf` ... `getGraphAsync({ xray: true })`) is `it.skip`ped: `studioOf` builds the workflows without
  the application's storage, so `ChunkLedgerRepository` (a `SqliteConnection` consumer) cannot be constructed there.
