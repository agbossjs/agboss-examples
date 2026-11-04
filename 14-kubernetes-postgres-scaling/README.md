# `14-kubernetes-postgres-scaling` — Kubernetes and PostgreSQL: Backlog, Scale-out, Failure, Recovery, Scale-in

> **Priority:** P1 — a backlog that never makes the workers grow, a killed pod whose work is lost or
> done twice, a frozen pod that writes after another took its work over, a scale-in that kills work:
> the first things a production cluster gets wrong
> **Principle:** Promise → Failure Injection → Reproducible Proof

Several AGBoss pods on several nodes share execution trees on one PostgreSQL database
(`@agboss/postgres`): no shared disk, so any pod continues any tree. KEDA scales the workers on the
work that waits, read from the core's OpenTelemetry metrics through the official Prometheus exporter.
One command brings a kind cluster up; one runs the whole cycle and verifies it **from state** — the
kept execution records, the lease log, the outbound calls and the other system's own ledger — never
from console output. The guarantees it shows, and what they assume:
[Guarantees](https://github.com/agbossjs/agboss/wiki/Guarantees),
[Several instances](https://github.com/agbossjs/agboss/wiki/Several-instances),
[Running on PostgreSQL](https://github.com/agbossjs/agboss/wiki/Running-on-PostgreSQL),
[Metrics](https://github.com/agbossjs/agboss/wiki/Metrics),
[Autoscaling](https://github.com/agbossjs/agboss/wiki/Autoscaling), and the operator's guide
[Deploying on Kubernetes](https://github.com/agbossjs/agboss/wiki/Deploying-on-Kubernetes).

## 1. Engineering Promises Tested

| Promise                                                          | Failure injected                                                                                      | AGBoss mechanism                                                                                                                                                                                                 | Proof                                                                                                                                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Workers grow with the backlog and shrink after it**            | 80 jobs queued at once on one worker                                                                  | the slot demand `max(agboss_cluster_children_queued) + sum(steps_waiting) + sum(step_slots_busy)`, 4 per pod, through KEDA                                                                                       | `cluster:scenario` › "AC2 scale-out", "AC2 scale-in" (the Deployment's replicas over time)                                                                                      |
| **A worker killed mid-run loses nothing and duplicates nothing** | `kill -9` of a busy worker, its pod deleted                                                           | the execution lease (30 s), the recovery sweep, `ChildPlacement.AnyInstance` children reclaimed                                                                                                                  | `cluster:scenario` › "AC3 …"; the verification: every job one finished child, one delivery, one ledger entry                                                                    |
| **A frozen worker that comes back cannot write**                 | `SIGSTOP` of a pod mid-step, `SIGCONT` after its lease was taken over                                 | its own fence (the lease's end on its own clock) and, for the window that fence does not see, the fenced effect (`saveResultIfAbsent`, #500): the lease and the scope's token checked in the store's transaction | "AC5 zombie cannot write" — refused by the store (`ExecutionFencedError`, `observedToken > token`) or stopped by its own fence first; no write at its token, from the lease log |
| **A worker killed before its write never wrote**                 | `kill -9` (exit 137) while its job waits for its remote work                                          | the same, and the lease log's takeover naming the holder                                                                                                                                                         | "AC5 killed with exit 137" — classified _never attempted_, not a refusal                                                                                                        |
| **A crash after the effect is replayed, not repeated**           | `kill -9` after the delivery committed and the ledger applied the entry, before the step's checkpoint | the fenced effect's stored result (`Replayed`); the outbound call's intent reconciled with the ledger (`OutboundCalls`, #505)                                                                                    | "AC5 the replayed effect applied once" — one ledger entry, one delivery                                                                                                         |
| **No fencing or idempotency tables in the application**          | —                                                                                                     | the stores keep tokens, marks, results and intents                                                                                                                                                               | [`tests/source/no-own-fencing.test.ts`](./tests/source/no-own-fencing.test.ts) (AC6)                                                                                            |

The verification ([`src/verification/verify.ts`](./src/verification/verify.ts)) classifies every
attempt at a job's protected write — _accepted_, _replayed_, _refused_, _never attempted_ or
_inconsistent_ — and a clean final result alone never passes: the scenario's own classifications must
be found. It bites: [`tests/verification/verify.test.ts`](./tests/verification/verify.test.ts) feeds it
a second delivery, a second ledger entry, a child that ended twice, a refusal with no takeover, a
replay of a token nobody wrote, a pending ledger call and a missing refusal, and each fails it.

## 2. The cycle

1. **Backlog.** The `agboss-load` Job posts a batch of 80 jobs (4 s each) to any ready pod. The batch
   (`batch-workflow`) queues one `job-workflow` per job in the shared child queue
   (`ChildPlacement.AnyInstance`); every pod with a free step slot (`maxConcurrentSteps: 4`) claims one.
2. **Scale-out.** Each pod reports its busy slots, and every pod the queue's depth (a cluster gauge:
   `max`, never `sum`); KEDA asks for ⌈demand / 4⌉ workers, at most 4 here.
3. **Distributed execution.** A job ([`ProcessJobAction`](./src/actions/process-job.action.ts)) does
   its remote work (the stub), then its **delivery** — a fenced effect keyed `job:<id>` — and its
   **ledger entry** — a call that leaves the system, its intent recorded before it is sent, with the
   Idempotency-Key the ledger deduplicates on.
4. **A worker killed mid-run.** The scenario finds a worker with a job in flight (the stub saw the
   call), kills it (`kill -9`) and deletes its pod. Its Deployment starts a new pod; its leases expire
   and the other pods take its jobs over from their last checkpoint.
5. **The dead and risen worker** (autoscaling paused at 3, so a scale-in cannot interfere):
   - a pod is **frozen** (`SIGSTOP`) while its job waits for its remote work; its lease expires,
     another pod takes the job over at a higher token and delivers it; the pod is **resumed**
     (`SIGCONT`), its client answers (it takes no `AbortSignal`, like many SDKs — the realistic zombie),
     it reaches its delivery with its stale token and is **refused**. Its liveness window (90 s) outlasts
     the takeover, so it is not restarted: it then takes new work as a normal member;
   - a pod is **killed with exit 137** before its write: _never attempted_;
   - a pod is **killed after its delivery committed and the ledger applied the entry**, before the
     step's checkpoint: the new holder's delivery is **replayed** (the stored receipt), its ledger call
     **reconciled** (the ledger is asked; nothing is sent again).
6. **Scale-in.** The demand falls to 0; KEDA brings the workers back to 1, one pod per 15 s after a
   30 s stabilization (production: 300 s, [`deploy/keda-scaledobject.yaml`](./deploy/keda-scaledobject.yaml)).
   A removed pod gets SIGTERM: its readiness turns `Unhealthy`, its running steps get
   `shutdownTimeout` (30 s), and `terminationGracePeriodSeconds` (45) covers the preStop sleep (5) plus
   that.
7. **Verification.** `POST /api/verification` on any pod reads every batch's kept record, its tree's
   lease log and outbound calls, and the stub's ledger, and answers the report.

## 3. Commands

Offline, no key, no cluster (R4):

```bash
npm run check       # agboss check, tsc, eslint
npm test            # the verification and its sabotage cases, the job step, a batch on two instances,
                    # the stub, the source rules (AC6), the manifests' budget, the scrape and scale rules
npm run demo        # two instances on one SQLite file: a batch, /metrics during and after, verified
npm run check:k8s   # kubeconform over deploy/ (Docker + network; no cluster)
```

The cluster — on a machine with **Docker**, **kind** (≥ 0.31) and **kubectl** (≥ 1.33); no Helm:

```bash
# until @agboss/core 0.1.1 and @agboss/postgres are on npm: clone agbossjs/agboss and agbossjs/postgres
# next to this repository, then at the repository root
npm ci && npm run pack:framework && npm run install:packed

cd 14-kubernetes-postgres-scaling
npm run cluster:up        # kind (node capped at 3 CPU / 4 GB), the image, PostgreSQL, KEDA, Prometheus, the pods
npm run cluster:scenario  # the cycle above; .artifacts/kubernetes-run.json; exit 0 only when every check passed
npm run cluster:down      # kind delete cluster
```

While it runs: `kubectl --context kind-agboss-scaling -n agboss get pods -w`, Prometheus on
<http://127.0.0.1:19090>, the stub's state on <http://127.0.0.1:18081/control/state>.

## 4. What runs in the cluster

| Workload                   | What                                                                                                                                              | Requests / limits           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `postgres`                 | PostgreSQL 16, every store of `@agboss/postgres` (demo `emptyDir`)                                                                                | 250m / 256Mi · 500m / 512Mi |
| `agboss-migrate` (Job)     | `agboss-postgres migrate`, before any pod starts                                                                                                  | 100m / 128Mi · 500m / 256Mi |
| `coordinator` (1)          | an AGBoss pod KEDA does not scale; a member like the others                                                                                       | 100m / 192Mi · 500m / 320Mi |
| `agboss-worker` (KEDA 1…4) | [`deploy/worker-deployment.yaml`](./deploy/worker-deployment.yaml) + [`deploy/kind/apps/worker-patch.yaml`](./deploy/kind/apps/worker-patch.yaml) | 200m / 192Mi · 500m / 256Mi |
| `ledger-stub`              | the other system: remote work, a ledger deduplicating on Idempotency-Key ([`src/stub/`](./src/stub/ledger-stub.ts))                               | 50m / 64Mi · 200m / 128Mi   |
| `prometheus-server`        | scrapes the annotated pods every 5 s ([`deploy/kind/monitoring/`](./deploy/kind/monitoring/prometheus.yaml))                                      | 100m / 128Mi · 300m / 256Mi |
| `agboss-load` (Job)        | the workload generator ([`src/load.ts`](./src/load.ts))                                                                                           | 50m / 64Mi · 200m / 128Mi   |
| KEDA 2.20.2                | its official release manifest                                                                                                                     | as released                 |

Every pod runs the same image: `dist/` and the installed `@agboss/core` and `@agboss/postgres`
packed back into tarballs ([`scripts/cluster/build-image.mjs`](./scripts/cluster/build-image.mjs)), with
`tini` as PID 1 so that SIGTERM reaches node and the scenario's signals reach it too.

**The coordinator claims jobs too.** It is an AGBoss instance, and the core has no opt-out of
claiming; KEDA's demand counts its busy slots, so at full load there is one worker more than strictly
needed.

## 5. The signals

|               | Expression                                                                                                                            | Why                                                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scale out** | `max(agboss_cluster_children_queued) + sum(agboss_instance_steps_waiting) + sum(agboss_instance_step_slots_busy)`, target `4` per pod | every step that wants a slot now; a pod has four                                                                                                                                                     |
| **Scale in**  | the same demand falling, held (300 s in production, 30 s here), one pod at a time                                                     | a short lull does not kill pods that are about to get work                                                                                                                                           |
| **Idle**      | `max(queued) + max(running) + sum(leases_held) + sum(busy) + sum(waiting) == 0`                                                       | nothing queued, running or held anywhere — the floor (`minReplicaCount`, at least 1: idle does not see a root handed over or left by a crash until a live pod's sweep takes it, agbossjs/agboss#751) |

`agboss_cluster_*` is read from the shared store and reported **by every pod** with the same value:
aggregate it with `max`, never `sum`. An HPA on prometheus-adapter
([`deploy/hpa-prometheus-adapter.yaml`](./deploy/hpa-prometheus-adapter.yaml)) works the same way, and
[`deploy/collector/`](./deploy/collector/) carries the OpenTelemetry Collector recipes for ECS, Cloud
Run and Container Apps.

## 6. A recorded run

One run of `npm run cluster:scenario`, as its artifact `.artifacts/kubernetes-run.json` recorded it
(2026-11-04, kind on Docker Desktop, the node capped at 3 CPU / 4 GB; `@agboss/core` at `06c4bc1d`,
`@agboss/postgres` at `3109b8c8`). 15 of 15 checks passed in 290 s; times are seconds from the
start.

| Step                                   | What happened (from state)                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline                               | 1 worker ready, slot demand 0                                                                                                                                                                                                                                                                                                                  |
| Backlog (AC1)                          | 80 jobs × 4 s posted at 2 s; demand peaked at 80, 76 children queued                                                                                                                                                                                                                                                                           |
| Scale-out (AC2)                        | 1 → 2 workers at 8 s, → 4 at 23 s: 4 workers 25 s after the backlog was submitted                                                                                                                                                                                                                                                              |
| A worker killed mid-run (AC3)          | `kill -9` at 11 s, the pod deleted; Kubernetes replaced it, and the other pods took its **4 leases** over (the lease log's `takeover` rows, token 2)                                                                                                                                                                                           |
| A frozen worker (AC5)                  | `SIGSTOP` at 53 s while its job waited for its remote work; another pod took the job over at token 2 after 34 s, then `SIGCONT`: its delivery at token 1 was **refused** (the store saw 2); no restart — the liveness window outlasted the freeze. (Another run may see it stop at its own lease's end before it writes: no write either way.) |
| The batch after it                     | 48 jobs × 12 s — longer than a sweep, so every pod claims — the resumed pod among the workers that took them: every child claimed and finished once (agbossjs/agboss#720 fixed the claim that could leave some held for ever)                                                                                                                  |
| A worker killed before its write (AC5) | `kill -9` at 156 s (the coordinator, this time) with its job's work held: exit code 137, restarted once; its job **never attempted** the delivery and ran once elsewhere                                                                                                                                                                       |
| A crash after the write (AC5)          | killed after its delivery and ledger entry, before the step's checkpoint: the next holder **replayed** the stored delivery — 1 ledger entry, 1 request                                                                                                                                                                                         |
| Scale-in (AC2)                         | autoscaling resumed at 225 s; 3 → 2 → 1 worker, 61 s after demand fell to 0 (stabilization 30 s, one pod per 15 s)                                                                                                                                                                                                                             |
| Verification (AC3, AC5)                | 131 jobs: 131 accepted, 1 replayed, 1 refused, 5 never attempted, **0 inconsistent, 0 duplicates**; the 4 expected outcomes all found                                                                                                                                                                                                          |

The node used 8 % CPU and 1.05 GiB idle, 15 % and 1.44 GiB with 4 workers on the backlog, and 6 %
and 1.26 GiB after the scale-in.

## 7. Layout

```
src/kubernetes-scaling.application.ts  the cluster's application: every store on PostgreSQL
src/local/                             the same workflows on SQLite (tests, demo; offline)
src/actions/process-job.action.ts      remote work → the delivery (fenced effect) → the ledger (outbound call)
src/services/                          the work and ledger clients; Deliveries over each store set's fenced effect
src/workflows/{batch,job}/             the backlog: one child per job, on any pod
src/http/server.ts                     probes, the batch API, the trees' evidence, the verification
src/verification/                      the evidence reader and the classifier (public API only)
src/stub/                              the other system
src/main.ts · src/stub-main.ts · src/load.ts   a pod, the stub's pod, the load Job
deploy/                                the shipped worker Deployment, KEDA / HPA configs, Collector recipes
deploy/kind/                           the blueprint: cluster, infrastructure, migration and load Jobs, the apps' patches, Prometheus
deploy/Dockerfile                      the pods' image
scripts/cluster/                       up, scenario, down, the image build
tests/                                 offline proofs (see Commands)
```

## 8. Guarantee Boundary

- What AGBoss guarantees here — one owner per tree, one effect per business key, one send per
  attempt, no takeover of finished work — holds under the assumptions of
  [Guarantees](https://github.com/agbossjs/agboss/wiki/Guarantees): the stores pass the contracts and
  the fault suite on PostgreSQL, the fencing stores share the lease store's database, the database's
  clock is slewed, never stepped, and the other system deduplicates on the Idempotency-Key.
- The **external** effect is exactly once because the ledger deduplicates (A7) and the outbound call
  reconciles before it resends; a system that cannot be asked what happened needs an operator
  (`app.pendingOutboundCalls`).
- The kind cluster is one node: node loss, a database failover and a network partition between nodes
  are the fault suite's (agbossjs/agboss#484) and the operator guide's, not this run's.
- PostgreSQL here is a demo `emptyDir`: a pod restart of the database loses everything. Production
  needs a managed or replicated database with durable storage.
