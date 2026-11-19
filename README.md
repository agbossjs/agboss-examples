# AGBoss Examples — Executable Architecture & Reliability Proofs

[![Docs](https://img.shields.io/badge/docs-agboss.dev-258ceb)](https://agboss.dev)
[![Framework](https://img.shields.io/badge/framework-agbossjs%2Fagboss-258ceb)](https://github.com/agbossjs/agboss)
[![License](https://img.shields.io/badge/License-Apache_2.0-258ceb.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Smoke CI](https://github.com/agbossjs/agboss-examples/actions/workflows/smoke.yml/badge.svg?branch=main)](https://github.com/agbossjs/agboss-examples/actions/workflows/smoke.yml)

Independent, runnable [**AGBoss**](https://github.com/agbossjs/agboss) applications that demonstrate and verify the framework's core engineering guarantees against real distributable npm packages (`@agboss/core` and `@agboss/cli`).

> **AGBoss is an open-source TypeScript framework with static verification for complex multi-agent workflows.**
>
> **Pre-release status (`v0.1.1-rc`):** `@agboss/core@0.1.1` and `@agboss/cli@0.1.1` are in release preparation (npm currently hosts only the initial `0.0.1` placeholders). Each example's `package.json` declares standard public registry ranges (`"^0.1.1"`). Until `0.1.1` is published to npm, run `npm run pack:framework && npm run verify:package && npm run install:packed` from the repository root to pack and install the local release-candidate tarballs into each example's `node_modules` without dirtying git-tracked manifests.
>
> **Pinned sources** ([`.agboss-version.json`](./.agboss-version.json)): `@agboss/core` and `@agboss/cli` `0.1.1` at [`agbossjs/agboss@d9db427b`](https://github.com/agbossjs/agboss/commit/d9db427b383bbc31e9214a3cf6c2620d52bca9a9); the store packages `0.1.0` (packed with the core until they are on npm) at [`agbossjs/postgres@eda95960`](https://github.com/agbossjs/postgres/commit/eda95960dd0f36156934276cd3245f316ba51bcd), [`agbossjs/mongodb@7b1f8ac7`](https://github.com/agbossjs/mongodb/commit/7b1f8ac7e0feb1f0740a3a38233858ac61243b24) and [`agbossjs/redis@1befd106`](https://github.com/agbossjs/redis/commit/1befd10658e97d846995ccae66444218641cfd3b).

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
| [**`15-mongo-redis`**](./15-mongo-redis/) | **P1** | Deterministic offline (the same workflows on SQLite); live on a MongoDB replica set + Redis by `npm run demo:live` | MongoDB + Redis (`@agboss/mongodb`, `@agboss/redis`): Redis coordinates — the leases, the child queue, the rate limits — and MongoDB keeps every durable record, wired by `MONGODB_DURABLE_STORES`, `REDIS_COORDINATION_STORES` and `provide(EXECUTION_ID_STORE, MongoExecutionLeaseRepository)` with no `new`; the assembly refuses a fenced-effect or outbound-call store beside Redis leases; the schema migrated by `agboss-mongodb migrate` |
| [**`16-browser-playwright`**](./16-browser-playwright/) | **P1** | Deterministic offline (a headless Chromium against a local site; `npm run browsers`) | A browser plugged into an agent two ways: plain Playwright as a `@Tool` with one shared browser (`deps`, `onDestroy`) and the official `@playwright/mcp` behind `@McpServer`; one origin allowlist (the context route plus the resolver rules, redirects included) refuses `127.0.0.1`, `169.254.169.254` and the LAN on both ways; a screenshot reaches the model as a file part under the PII policy; a contact form is filed once through an outbound call keyed by the request's reference — a lost answer, a repeat and a crash on two instances included |
| [**`17-browser-bot-bypass`**](./17-browser-bot-bypass/) | **P1** | Deterministic offline (a fake browser factory: no Chrome in CI); one manual live run on real Chrome | `playwright-bot-bypass`'s `createStealthBrowser` (vendored under MIT, over `rebrowser-playwright`; needs real headed Chrome, does not beat IP reputation, rate limits or CAPTCHA, authorized use only) wired as a `@Tool` with the browser injected and as an own MCP server, behind the same allowlist — the browser has its own network, outside the A2A SSRF guard

### Live runs at the `0.1.1` pins (2026-11-19)

The offline gate (`check`, `test`, `demo` of all 17 projects) passes on the packed `0.1.1` tarballs. The live modes were run once on top of it, against the pins above:

| Project | Live run | Models / servers | Cost |
| :--- | :--- | :--- | :--- |
| `01-hello-agboss` | `npm run demo:live` | `openai/gpt-4o-mini` through OpenRouter | not reported by the demo (two calls) |
| `03-support-refund-desk` | `npm run demo:files:live` | `google/gemini-2.5-flash-lite` reads a receipt photo | $0.000317 |
| `08-job-scout` | `npm run demo:live` | `moonshotai/kimi-k2.6` agents, `typesafe/jev-1.13` router and guardrails | $0.019146 in 284 calls |
| `09-review-loop-and-routing` | `npm run demo:live` | `google/gemini-2.5-flash-lite`, `typesafe/jev-1.13` router | $0.000634 and $0.000640 in the two runs it prints, plus the routing table's cents |
| `10-quorum-groups-and-replies` | `npm run demo:live` | `openai/gpt-4.1-nano`, `openai/gpt-4o-mini`, `typesafe/jev-1.13` | not reported by the demo (a few nano calls) |
| `14-kubernetes-postgres-scaling` | `npm run cluster:up && npm run cluster:scenario` | kind (3 CPU / 4 GB) with PostgreSQL 16, KEDA, Prometheus; no model | 18 checks passed in 303 s |
| `15-mongo-redis` | `npm run demo:live` and the live test | a three-member MongoDB 7 replica set and Redis, no model | the recount: 12 shelves on 2 instances, each once |
| `16-browser-playwright` | `npm run demo:live` | `openai/gpt-4.1-nano` through OpenRouter, headless Chromium | $0.001163 |

`17-browser-bot-bypass` needs real headed Chrome (its README, section 5): a manual run, not made here. `02`, `04`-`07`, `11`-`13` have no live mode.

---

## 3. Repository Design Rules

- **R1. Independent projects:** Every example directory has its own `package.json`, `.env.example`, `tsconfig.json`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `.agents/skills/agboss/`, commands, and unit/integration tests. You can `cd` into any example and run it standalone.
- **R2. No direct source dependency:** Examples never import from the `agboss` monorepo `src/`, never use private framework internals (`@agboss/core/internal` is refused by `agboss/no-internal-import`, agbossjs/agboss#818), never use `workspace:*` links to the framework, and never use symlinks.
- **R3. Minimal shared tooling:** [`scripts/tooling/`](./scripts/tooling/) provides only process execution, temp-directory isolation, diagnostic/ledger assertions, and `proof-results.json` report generation — never a wrapper around AGBoss.
- **R4. Offline-first (`$0`):** All default checks (`npm run check`), tests (`npm test`), and demos (`npm run demo`) run 100% offline with zero LLM API keys. Live model runs (`npm run demo:live`) are opt-in.
- **R5. Isolated negative fixtures:** Intentional broken graphs (such as `02-path-scope-proof/cases/*/agboss-broken`) are invoked by test harnesses that assert their exact failure diagnostics without breaking default green CI.
- **R6. Zero secrets or real PII:** Only synthetic data is used. `.env` files, real traces, and API keys are strictly git-ignored (see [`.gitignore`](./.gitignore) and [`.env.example`](./.env.example)).

---

## 4. Quick Start

### Workflow A — Pre-Release / Release-Candidate Validation (Local Tarballs)

Until `@agboss/core@0.1.1` and `@agboss/cli@0.1.1` are published to the public npm registry, build and pack the release candidate from the `agboss` repository and install the `.tgz` artifacts into the example projects:

```bash
# 1. Install root tooling dependencies & run tooling tests
npm install
npm run typecheck

# 2. Pack @agboss/core & @agboss/cli (and the postgres, mongodb and redis stores, each at its pinned SHA, from ../postgres, ../mongodb, ../redis or AGBOSS_*_DIR) from ../agboss (or set AGBOSS_REPO_DIR=/path/to/agboss)
npm run pack:framework

# 3. Verify tarball contents, isolated consumer imports, CLI bin & clean scaffold outside both repos
npm run verify:package
npm run verify:published -- --from-packed --version 0.1.1

# 4. Install packed tarballs into every example's node_modules (restoring clean ^0.1.1 specs in package.json)
npm run install:packed

# 5. Run P0 + P1 static checks, tests, and offline demos, then collect fail-closed RC proof report
node scripts/run-all.mjs --provenance rc --include-p1 --reset --mode check
node scripts/run-all.mjs --provenance rc --include-p1 --mode test
AGBOSS_OFFLINE_VERIFY=1 node scripts/run-all.mjs --provenance rc --include-p1 --mode demo
node scripts/collect-results.mjs --provenance rc --require-p1
npm run install:packed -- --restore
```

### Workflow B — Public Consumer & Post-Publication Registry Verification (Post-Publication on npm)

Once `@agboss/core@0.1.1` and `@agboss/cli@0.1.1` are published to npm, verify the live registry packages across an isolated consumer, a freshly scaffolded app, and all 17 example projects:

```bash
# 1. Verify live npm registry metadata, isolated consumer subpath exports, and `agboss create` scaffold:
npm run verify:published -- --live-registry --version 0.1.1

# 2. Install live registry packages across all 17 examples and collect published-package proof report:
npm run install:published -- --live-registry --version 0.1.1
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
