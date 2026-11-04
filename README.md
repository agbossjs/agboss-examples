# AGBoss Examples — Executable Architecture & Reliability Proofs

[![Docs](https://img.shields.io/badge/docs-agboss.dev-258ceb)](https://agboss.dev)
[![Framework](https://img.shields.io/badge/framework-agbossjs%2Fagboss-258ceb)](https://github.com/agbossjs/agboss)
[![License](https://img.shields.io/badge/License-Apache_2.0-258ceb.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Smoke CI](https://github.com/agbossjs/agboss-examples/actions/workflows/smoke.yml/badge.svg?branch=main)](https://github.com/agbossjs/agboss-examples/actions/workflows/smoke.yml)

Independent, runnable [**AGBoss**](https://github.com/agbossjs/agboss) applications that demonstrate and verify the framework's core engineering guarantees against real distributable npm packages (`@agboss/core` and `@agboss/cli`).

> **AGBoss is an open-source TypeScript framework with static verification for complex multi-agent workflows.**
>
> **Pre-release status (`v0.1.0-rc`):** `@agboss/core@0.1.0` and `@agboss/cli@0.1.0` are currently in release-candidate preparation (npm currently hosts the initial `0.0.1` placeholders). Each example's `package.json` declares standard public registry ranges (`"^0.1.0"`). Until `0.1.0` is published to npm, run `npm run pack:framework && npm run verify:package && npm run install:packed` from the repository root to pack and install the local release-candidate tarballs into each example's `node_modules` without dirtying git-tracked manifests.

---

## 1. Purpose & Central Principle

This repository serves three goals:

1. **Developer onboarding:** Help a new developer understand, install, and run AGBoss without familiarity with its internal source tree.
2. **Executable architectural proofs:** Demonstrate concrete failure classes, inject/reproduce them deterministically, and prove with executable assertions how AGBoss detects, prevents, compensates, or recovers from them.
3. **External release validation:** Validate the actual packed `.tgz` / published npm artifacts in clean consumer projects outside the `agboss` monorepo.

### Central Principle: `Promise → Failure Injection → Reproducible Proof`

Every project in this repository answers six engineering questions with executable assertions:

1. **Promise:** What engineering property does AGBoss claim to provide?
2. **Threat:** What concrete error or failure threatens that property?
3. **Failure Injection:** How is that failure deterministically reproduced?
4. **Mechanism:** What does AGBoss detect, prevent, compensate, or recover?
5. **Proof:** What observable state, diagnostic code, or ledger invariant proves the expected behavior?
6. **Guarantee Boundary:** Where does the framework guarantee end, and what remains the application's or external system's responsibility?

---

## 2. Projects & Release Priorities

| Project | Priority | Mode | Primary Engineering Proof |
| :--- | :--- | :--- | :--- |
| [**`01-hello-agboss`**](./01-hello-agboss/) | **P0** | Deterministic / Offline (+ optional Live) | Clean `agboss create` installation, constructor DI, `@Agent`, `@Router`, `@Tool`, `@Workflow`, typed DTOs, unit testing, and first execution |
| [**`02-path-scope-proof`**](./02-path-scope-proof/) | **P0** | Deterministic / Static Analysis | Compile-time detection of `[input.missing-on-path]`, `[input.outdated-on-path]`, `[launch.branch-outdates-sibling]`, and `[flow.uncompensated-action]` vs ordinary TypeScript / LangGraph |
| [**`03-support-refund-desk`**](./03-support-refund-desk/) | **P0** | Deterministic / Offline (+ Eval Pipeline) | `@PiiPolicy` (`replaceWithToken`) trace/log scrubbing, `@ToolInterceptor` & `DecidedBy.Code` guardrails, `@Compaction` vs authoritative `@Rag` policy freshness, and 5-layer evaluation (`pass@k` vs `pass^k`, Cohen's $\kappa$) |
| [**`04-travel-booking-saga`**](./04-travel-booking-saga/) | **P0** | Deterministic / Fault-Injection | LIFO saga compensation, `@Budget` cutoff, `app.cancel()`, worker crash recovery over SQLite WAL, external `idempotencyKey` boundary, `.joinQuorum()` arbitration, and HITL pause withdrawal |
| [**`05-cluster-work-stealing`**](./05-cluster-work-stealing/) | **P1** | Deterministic Multi-Instance / Fault-Injection | `ChildPlacement.AnyInstance`, recursive `ThisWorkflow` (`maxDepth`), 30s SQLite leases & fencing, worker crash recovery, `maxConcurrentSteps` backpressure, `@HealthCheck`, and cross-instance `app.cancel()` |
| [**`06-enterprise-agent-mesh`**](./06-enterprise-agent-mesh/) | **P1** | Deterministic Multi-Service | 3-service mesh (`1-order-gateway`, `2-billing-a2a`, `3-catalog-mcp`) over `@A2AAgent` / `@A2AExpose`, `A2AMeshEnvelope`, `MeshLoopDetectedError`, MCP `_meta.callId` deduplication, and `agboss check --federation` Blast Radius |
| [**`07-langgraph-migration`**](./07-langgraph-migration/) | **P0** | Deterministic Before/After Showcase | Side-by-side comparison of raw `@langchain/langgraph` (`before-langgraph/` with `Annotation.Root` God State, string edges, side effects in tools, dynamic system prompts) vs AGBoss (`after-agboss/` with narrow `@Dto`, Flow DSL, `@Router`, `@Action`, and `agboss check --strict`) |
| [**`08-job-scout`**](./08-job-scout/) | **P1** | Deterministic / Offline (+ optional Live) | A real multi-step agent moved from the AGBoss monorepo: Jev `@Router` over three agents, Greenhouse `@Tool` with a per-job Jev judge, `@Rag` company notes, filesystem `@McpTool` save behind an approval pause, input/output guardrails, `@Budget` cutoff, VCR replay, and an offline demo with a ledger |
| [**`09-review-loop-and-routing`**](./09-review-loop-and-routing/) | **P0** | Deterministic / Offline (+ optional Live) | The same credit application routed by a `DecidedBy.Code` router (0 calls, $0) and a `DecidedBy.Model` router (Jev) onto the same routes, `[router.routes-mismatch]` on a missing route, and a critique ↔ editor loop bounded by `maxVisits` and `historyOf(CreditMemoDto, { limit: 2 })`, ending on a defined finish when the critic never accepts |
| [**`10-quorum-groups-and-replies`**](./10-quorum-groups-and-replies/) | **P1** | Deterministic / Offline (+ optional Live) | Four parallel reviews in two `.joinQuorumGroups(…)` groups, each answer through an arbiter chain (`.acceptedBy(code)`, `.acceptedBy(anyOf(code, model))`) with recorded `BranchVerdict`s and `rejectedBy`, `QuorumNotReachedError` on a deadline, and a free-text approval read by a `@ReplyInterpreter` into a capped order — an unreadable reply leaves the pause pending |
| [**`11-safe-payments`**](./11-safe-payments/) | **P0** | Deterministic / Fault-Injection (+ real processes) | Every payment race of the Payments taxonomy (PS1–PS23) done wrong and done right against a fictional stub gateway at three support levels (`Full`, `NoLookup`, `NoKeys`): a lost answer, a crash, a zombie, two executions, a duplicated webhook, a key past its retention, a refund retried — one charge and one refund, every number from the stub's own records; "check your own gateway call" by swapping one `PaymentOperations` class |
| [**`12-payment-gateways`**](./12-payment-gateways/) | **P0** | Deterministic / Fault-Injection (official SDKs against local stubs) | The Payments contract on ten gateways: a verdict per gateway quoted from its own docs (Stripe, Adyen, PayPal, Checkout.com and CardCom supported; Braintree, Square, Tranzila, Grow and PayPlus not, with the reason), and for each supported one the right wiring on its official SDK (`stripe`, `@adyen/api-library`, `@paypal/paypal-server-sdk` over TLS, `checkout-sdk-node`; CardCom's HTTP API) run through its relevant failures against a stub of its documented behaviour — one charge, one refund, or the named boundary |
| [**`13-rag-reranking`**](./13-rag-reranking/) | **P1** | Deterministic / Offline (an official SDK against a local stub) | A knowledge base reranked before the agent reads it: Cohere Rerank on `cohere-ai` behind a code `@Reranker` puts the passage the retriever ranked 27th of 30 first, in tool and context mode; its cost in the budgets; a 503 falls back to the retriever's order; AGBoss's LLM reranker swaps in by one line of the `@Rag`; the RAG contract holds through the reranker |
| [**`14-kubernetes-postgres-scaling`**](./14-kubernetes-postgres-scaling/) | **P1** | Deterministic offline (SQLite, the official Prometheus exporter); the cluster run on kind + PostgreSQL by `npm run cluster:scenario` (nightly CI) | Kubernetes + PostgreSQL (`@agboss/postgres`): a backlog scales the workers out through KEDA on the core's OpenTelemetry metrics and back in after it; a worker killed mid-run, a frozen worker that comes back (its write refused), one killed before and one after its write — every job and every external side effect exactly once, verified from the stores' state and the other system's ledger, never console output; OTel Collector recipes for ECS, Cloud Run and Container Apps |

---

## 3. Repository Design Rules

- **R1. Independent projects:** Every example directory has its own `package.json`, `.env.example`, `tsconfig.json`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `.claude/skills/agboss/`, commands, and unit/integration tests. You can `cd` into any example and run it standalone.
- **R2. No direct source dependency:** Examples never import from the `agboss` monorepo `src/`, never use private framework internals, never use `workspace:*` links to the framework, and never use symlinks.
- **R3. Minimal shared tooling:** [`scripts/tooling/`](./scripts/tooling/) provides only process execution, temp-directory isolation, diagnostic/ledger assertions, and `proof-results.json` report generation — never a wrapper around AGBoss.
- **R4. Offline-first (`$0`):** All default checks (`npm run check`), tests (`npm test`), and demos (`npm run demo`) run 100% offline with zero LLM API keys. Live model runs (`npm run demo:live`) are opt-in.
- **R5. Isolated negative fixtures:** Intentional broken graphs (such as `02-path-scope-proof/cases/*/agboss-broken`) are invoked by test harnesses that assert their exact failure diagnostics without breaking default green CI.
- **R6. Zero secrets or real PII:** Only synthetic data is used. `.env` files, real traces, and API keys are strictly git-ignored (see [`.gitignore`](./.gitignore) and [`.env.example`](./.env.example)).

---

## 4. Quick Start

### Workflow A — Pre-Release / Release-Candidate Validation (Local Tarballs)

Until `@agboss/core@0.1.0` and `@agboss/cli@0.1.0` are published to the public npm registry, build and pack the release candidate from the `agboss` repository and install the `.tgz` artifacts into the example projects:

```bash
# 1. Install root tooling dependencies & run tooling tests
npm install
npm run typecheck

# 2. Pack @agboss/core & @agboss/cli from ../agboss (or set AGBOSS_REPO_DIR=/path/to/agboss)
npm run pack:framework

# 3. Verify tarball contents, isolated consumer imports, CLI bin & clean scaffold outside both repos
npm run verify:package
npm run verify:published -- --from-packed --version 0.1.0

# 4. Install packed tarballs into every example's node_modules (restoring clean ^0.1.0 specs in package.json)
npm run install:packed

# 5. Run P0 + P1 static checks, tests, and offline demos, then collect fail-closed RC proof report
node scripts/run-all.mjs --provenance rc --include-p1 --reset --mode check
node scripts/run-all.mjs --provenance rc --include-p1 --mode test
AGBOSS_OFFLINE_VERIFY=1 node scripts/run-all.mjs --provenance rc --include-p1 --mode demo
node scripts/collect-results.mjs --provenance rc --require-p1
npm run install:packed -- --restore
```

### Workflow B — Public Consumer & Post-Publication Registry Verification (Post-Publication on npm)

Once `@agboss/core@0.1.0` and `@agboss/cli@0.1.0` are published to npm, verify the live registry packages across an isolated consumer, a freshly scaffolded app, and all 14 example projects:

```bash
# 1. Verify live npm registry metadata, isolated consumer subpath exports, and `agboss create` scaffold:
npm run verify:published -- --live-registry --version 0.1.0

# 2. Install live registry packages across all 14 examples and collect published-package proof report:
npm run install:published -- --live-registry --version 0.1.0
node scripts/run-all.mjs --provenance published --include-p1 --reset --mode check
node scripts/run-all.mjs --provenance published --include-p1 --mode test
AGBOSS_OFFLINE_VERIFY=1 node scripts/run-all.mjs --provenance published --include-p1 --mode demo
npm run collect:published
```

Or run any individual example directory standalone directly from the registry:

```bash
cd 01-hello-agboss
npm install
npm run check     # Static graph analysis (agboss check --strict --cassettes) + TypeScript + ESLint
npm test          # Deterministic offline unit & workflow tests ($0, no API key)
npm run demo      # Local offline demonstration
```

---

## 5. Common Project Commands

Every example project exposes a consistent command contract:

| Command | Description | Requires API Key? |
| :--- | :--- | :--- |
| `npm run check` | Static graph verification (`agboss check --strict --cassettes`: warnings are errors, cassettes checked) and TypeScript typechecking | No (`$0`) |
| `npm test` | Deterministic offline unit, integration, and failure-injection tests | No (`$0`) |
| `npm run demo` | Reproducible local demonstration of the project's proofs | No (`$0`) |
| `npm run demo:live` | Optional live execution via OpenRouter (`OPENROUTER_API_KEY` in `.env`) | Yes |

---

## 6. Contributing & Security

- See [CONTRIBUTING.md](./CONTRIBUTING.md) for issue workflow, branching, and verification rules.
- See [SECURITY.md](./SECURITY.md) for responsible vulnerability reporting (`security@agboss.dev`).
- Licensed under the [Apache License 2.0](./LICENSE). Copyright 2026 [Pavel Ravvich](https://github.com/pavelravvich).
