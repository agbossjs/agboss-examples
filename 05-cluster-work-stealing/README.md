# `05-cluster-work-stealing` — Distributed Scheduling, Leases, Fencing & Backpressure

> **Priority:** P1 — Distributed Cluster Scheduling & Fault Recovery Proof  
> **Principle:** Promise → Failure Injection → Reproducible Proof

## 1. Engineering Promises Tested

| Promise | Threat / Failure Injected | AGBoss Mechanism | Executable Proof |
|---|---|---|---|
| **Distributed work stealing & bounded recursion** | Single worker bottleneck or unbounded recursive fan-out (`ThisWorkflow`) | `.toParallelWorkflows(ChunkWorkerWorkflow, { placement: ChildPlacement.AnyInstance })`, `SqliteChildExecutionQueueRepository`, `ThisWorkflow` + `maxDepth: 2` | [`tests/workflows/coordinator/coordinator.workflow.test.ts`](./tests/workflows/coordinator/coordinator.workflow.test.ts) |
| **30s execution leases, fencing & idempotent recovery** | Instance 1 stalls beyond the 30s lease and attempts to write after Instance 2 takes over | `SqliteExecutionLeaseRepository`, `ExecutionLeaseLostError` (`execution.lease-lost`), `executionContext.step.idempotencyKey` | [`tests/workflows/coordinator/coordinator.workflow.test.ts`](./tests/workflows/coordinator/coordinator.workflow.test.ts) |
| **Step-slot backpressure & Kubernetes health probes** | Burst traffic saturates `maxConcurrentSteps: 2` or storage latency spikes | `@Application({ maxConcurrentSteps: 2, healthChecks })`, `HealthComponentKind.StepSlots` (`Degraded`), `@HealthCheck` (`app.checkLiveness()` / `app.checkReadiness()`) | [`tests/health-checks/storage-cluster.health-check.test.ts`](./tests/health-checks/storage-cluster.health-check.test.ts) |
| **Cross-instance pause/resume/cancel & version guard** | Pause created on Instance 1 is answered/cancelled on Instance 2, or resumed after a breaking workflow version deploy | `SqlitePausedExecutionRepository`, `SqliteExecutionTreeRepository`, `IncompatibleResumeError` (`resume.incompatible`), `WorkflowSettings.builder().onIncompatibleResume(...)` | [`tests/workflows/coordinator/coordinator.workflow.test.ts`](./tests/workflows/coordinator/coordinator.workflow.test.ts) |

## 2. Canonical `src/` & Symmetric `tests/` Layout

- [`src/workflows/coordinator/`](./src/workflows/coordinator/) — `coordinator.workflow.ts`, `coordinator.workflow-start.ts`, `coordinator.workflow-finish.ts`.
- [`src/workflows/chunk-worker/`](./src/workflows/chunk-worker/) — `chunk-worker.workflow.ts`, `chunk-worker.workflow-start.ts`, `chunk-worker.workflow-finish.ts`, `chunk-failed.workflow-finish.ts`.
- [`src/workflows/recursive-decomposer/`](./src/workflows/recursive-decomposer/) — `recursive-decomposer.workflow.ts`, `recursive-decomposer.workflow-start.ts`, `recursive-decomposer.workflow-finish.ts`, `recursive-decomposer-failed.workflow-finish.ts`.
- [`src/services/cluster-ledger.service.ts`](./src/services/cluster-ledger.service.ts) & [`src/health-checks/storage-cluster.health-check.ts`](./src/health-checks/storage-cluster.health-check.ts) — Idempotent external ledger and `@HealthCheck` probe.
- `tests/` — Mirrors `src/`:
  - [`tests/actions/partition-batch.action.test.ts`](./tests/actions/partition-batch.action.test.ts)
  - [`tests/health-checks/storage-cluster.health-check.test.ts`](./tests/health-checks/storage-cluster.health-check.test.ts)
  - [`tests/workflows/coordinator/coordinator.workflow.test.ts`](./tests/workflows/coordinator/coordinator.workflow.test.ts) (including `studioOf` + `getGraphAsync({ xray: true })` subgraph & recursive `ThisWorkflow` verification)

## 3. Commands

```bash
npm run check   # Run agboss check + TypeScript + ESLint
npm test        # Run all distributed cluster & isolated component proof suites
npm run demo    # Run deterministic offline cluster demo
```

## 4. Guarantee Boundary (Two-Process SQLite vs Multi-Host Deployment)

The tests in this example (`testWith(ClusterWorkStealingApplication, { instances: 2 })`) verify two application instances coordinating over a shared local SQLite WAL file (`SqliteExecutionLeaseRepository`, `SqliteChildExecutionQueueRepository`, `SqliteCheckpointSaver`, `SqlitePausedExecutionRepository`) on a single machine. For multi-host distributed deployments across separate machines or pods without shared local disk, applications must provide repository implementations backed by a networked transactional store (such as PostgreSQL or Redis) that satisfy the same AGBoss repository contracts.
