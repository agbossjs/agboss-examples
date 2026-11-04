# `14-kubernetes-postgres-scaling` — Workers Kubernetes Scales on Real Queued Work

> **Priority:** P1 — a backlog that never makes the workers grow, or a scale-in that kills work, is
> the first thing a production cluster gets wrong
> **Principle:** Promise → Failure Injection → Reproducible Proof

A batch is one `batch-workflow` that queues one `job-workflow` per job in the shared child queue
(`ChildPlacement.AnyInstance`); every worker with a free step slot (`maxConcurrentSteps: 4`) claims
them. The core publishes how much work waits and how busy each worker is through **OpenTelemetry
metrics** ([Metrics](https://github.com/agbossjs/agboss/wiki/Metrics), agbossjs/agboss#485); the
official Prometheus exporter serves them; KEDA (or an HPA on prometheus-adapter) scales the
Deployment on them ([Autoscaling](https://github.com/agbossjs/agboss/wiki/Autoscaling),
agbossjs/agboss#486). No AGBoss-specific exporter or package: `src/telemetry.ts` is the whole recipe.

```
src/telemetry.ts                     the recipe: MeterProvider + PrometheusExporter (:9464/metrics)
src/main.ts                          a worker pod: createApp(App, { meterProvider }), probes, SIGTERM
src/http/server.ts                   /health/live, /health/ready, POST /api/batches
src/workflows/{batch,job}/           the backlog: one child per job, on any worker
deploy/worker-deployment.yaml        probes, resources, terminationGracePeriodSeconds vs shutdownTimeout, scrape
deploy/keda-scaledobject.yaml        KEDA (recommended): scale on slot demand, 4 per pod
deploy/hpa-prometheus-adapter.yaml   or a plain HPA on prometheus-adapter's external metric
deploy/prometheus-adapter-values.yaml   the adapter's rule for that metric
deploy/collector/                    ECS (CloudWatch), Cloud Run (Managed Prometheus), Container Apps (KEDA)
```

## The signals

| | Expression | Why |
| --- | --- | --- |
| **Scale out** | `max(agboss_cluster_children_queued) + sum(agboss_instance_steps_waiting) + sum(agboss_instance_step_slots_busy)`, target `4` per pod | every step that wants a slot now; a pod has four |
| **Scale in** | the same demand falling, held 300 s, one pod a minute | a short lull does not kill pods that are about to get work |
| **Idle** | `max(queued) + max(running) + sum(leases_held) + sum(busy) + sum(waiting) == 0` | nothing queued, running or held anywhere — the floor (`minReplicaCount`, at least 1: idle does not see a root handed over or left by a crash until a live pod's sweep takes it, agbossjs/agboss#751) |

`agboss_cluster_*` is read from the shared store and reported **by every pod** with the same value:
aggregate it with `max`, never `sum` (three pods, twelve queued: `max` is 12, `sum` 36).

**Graceful termination.** A scale-in sends SIGTERM to some pod. `createApp` closes the app: its
readiness turns `Unhealthy` (the pod leaves the Service), running steps get `shutdownTimeout` (30 s)
to finish, and whatever still runs is handed over — its lease expires and another pod recovers the
tree. So `terminationGracePeriodSeconds` (45) must exceed the preStop sleep (5) plus
`shutdownTimeout` (30): a SIGKILL inside the stop is a crash, recovered too, but later.

## Commands

```bash
npm run check       # agboss check, tsc, eslint — offline
npm test            # the scrape test (AC1) and the scale rules (AC3) — offline
npm run demo        # one worker, twelve jobs: /metrics during the backlog and after it
npm run check:k8s   # kubeconform over deploy/ (Docker + network; no cluster)
```

`npm run demo` prints the Prometheus lines the autoscaler reads:

```
--- GET /metrics (12 jobs, 4 slots: the backlog)
agboss_cluster_children_queued{…} 8
agboss_instance_step_slots_busy{…} 4
…
--- GET /metrics (after the batch: idle)
agboss_cluster_children_queued{…} 0
agboss_instance_step_slots_busy{…} 0
```

## What comes next (agbossjs/agboss#487)

This folder grows into the full blueprint: PostgreSQL for the stores (`@agboss/postgres` in place of
the SQLite providers — nothing else in the application changes), a kind/k3d cluster brought up by
one command, a workload generator, a worker killed and a worker frozen mid-step, and a verification
that reads execution records: backlog → scale-out → distributed execution → failure → recovery →
scale-in. Until then the stores are SQLite and the cluster run is not here.
