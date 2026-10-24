# `cluster-work-stealing` — Distributed Scheduling, Leases, Fencing & Backpressure

> **Priority:** P1 — Distributed Cluster Scheduling & Fault Recovery Proof  
> **Principle:** Promise → Failure Injection → Reproducible Proof

## 1. Engineering Promises Tested

| Promise | Threat / Failure Injected | AGBoss Mechanism | Executable Proof |
|---|---|---|---|
| **Distributed work stealing & bounded recursion** | Single worker bottleneck or unbounded recursive fan-out (`ThisWorkflow`) | `.toParallelWorkflows(ChunkWorkerWorkflow, { placement: ChildPlacement.AnyInstance })`, `SqliteChildExecutionQueueRepository`, `ThisWorkflow` + `maxDepth: 2` | [`tests/work-stealing-and-recursion.test.ts`](./tests/work-stealing-and-recursion.test.ts) |
| **30s execution leases, fencing & idempotent recovery** | Instance 1 stalls beyond the 30s lease and attempts to write after Instance 2 takes over | `SqliteExecutionLeaseRepository`, `ExecutionLeaseLostError` (`execution.lease-lost`), `executionContext.step.idempotencyKey` | [`tests/lease-and-fencing.test.ts`](./tests/lease-and-fencing.test.ts) |
| **Step-slot backpressure & Kubernetes health probes** | Burst traffic saturates `maxConcurrentSteps: 2` or storage latency spikes | `@Application({ maxConcurrentSteps: 2, healthChecks })`, `HealthComponentKind.StepSlots` (`Degraded`), `@HealthCheck` (`app.checkLiveness()` / `app.checkReadiness()`) | [`tests/backpressure-and-health.test.ts`](./tests/backpressure-and-health.test.ts) |
| **Cross-instance pause/resume/cancel & version guard** | Pause created on Instance 1 is answered/cancelled on Instance 2, or resumed after a breaking workflow version deploy | `SqlitePausedExecutionRepository`, `SqliteExecutionTreeRepository`, `IncompatibleResumeError` (`resume.incompatible`), `WorkflowSettings.builder().onIncompatibleResume(...)` | [`tests/cross-instance-and-versioning.test.ts`](./tests/cross-instance-and-versioning.test.ts) |

## 2. Architecture

- [`coordinator/coordinator.workflow.ts`](./coordinator/coordinator.workflow.ts) — `CoordinatorWorkflow` partitioning a batch into chunks and launching `ChunkWorkerWorkflow` with `placement: ChildPlacement.AnyInstance`.
- [`worker/chunk-worker.workflow.ts`](./worker/chunk-worker.workflow.ts) — `ChunkWorkerWorkflow` with `ClusterQueueChunkSignOffChannel` (`@Channel`), `CommitChunkEffectAction` recording `executionContext.step.idempotencyKey`, soft-failure path, and `.onIncompatibleResume(...)` version guard.
- [`worker/recursive-decomposer.workflow.ts`](./worker/recursive-decomposer.workflow.ts) — `RecursiveDecomposerWorkflow` demonstrating bounded `ThisWorkflow` recursion (`maxDepth: 2`).
- [`storage/cluster-ledger.service.ts`](./storage/cluster-ledger.service.ts) & [`storage/storage-cluster.health-check.ts`](./storage/storage-cluster.health-check.ts) — Idempotent external ledger and `@HealthCheck` probe.

## 3. Commands

```bash
npm run check   # Run agboss check + TypeScript + ESLint
npm test        # Run all 4 distributed cluster proof suites
npm run demo    # Run deterministic offline cluster demo
```
