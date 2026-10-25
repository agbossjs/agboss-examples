# AGBoss Examples — Executable Architecture & Reliability Proofs

[![Docs](https://img.shields.io/badge/docs-agboss.dev-258ceb)](https://agboss.dev)
[![Framework](https://img.shields.io/badge/framework-agbossjs%2Fagboss-258ceb)](https://github.com/agbossjs/agboss)
[![License](https://img.shields.io/badge/License-Apache_2.0-258ceb.svg)](https://www.apache.org/licenses/LICENSE-2.0)
[![Smoke CI](https://github.com/agbossjs/agboss-examples/actions/workflows/smoke.yml/badge.svg?branch=main)](https://github.com/agbossjs/agboss-examples/actions/workflows/smoke.yml)

Independent, runnable [**AGBoss**](https://github.com/agbossjs/agboss) applications that demonstrate and verify the framework's core engineering guarantees against real distributable npm packages (`agboss` and `agboss-cli`).

> **AGBoss is an open-source TypeScript framework with static verification for complex multi-agent workflows.**
>
> **Pre-release status (`v0.1.0-rc`):** `agboss@0.1.0` and `agboss-cli@0.1.0` are currently in release-candidate preparation (npm currently hosts the initial `0.0.1` placeholders). Each example's `package.json` declares standard public registry ranges (`"^0.1.0"`). Until `0.1.0` is published to npm, run `npm run pack:framework && npm run verify:package && npm run install:packed` from the repository root to pack and install the local release-candidate tarballs into each example's `node_modules` without dirtying git-tracked manifests.

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

Until `agboss@0.1.0` and `agboss-cli@0.1.0` are published to the public npm registry, build and pack the release candidate from the `agboss` repository and install the `.tgz` artifacts into the example projects:

```bash
# 1. Install root tooling dependencies & run tooling tests
npm install
npm run typecheck

# 2. Pack agboss & agboss-cli from ../agboss (or set AGBOSS_REPO_DIR=/path/to/agboss)
npm run pack:framework

# 3. Verify tarball contents, isolated consumer imports, CLI bin & clean scaffold outside both repos
npm run verify:package

# 4. Install packed tarballs into 01..07/node_modules (restoring clean ^0.1.0 specs in package.json)
npm run install:packed

# 5. Run P0 + P1 static checks, tests, and offline demos, then collect fail-closed proof report
node scripts/run-all.mjs --include-p1 --reset --mode check
node scripts/run-all.mjs --include-p1 --mode test
node scripts/run-all.mjs --include-p1 --mode demo
node scripts/collect-results.mjs --require-p1
```

### Workflow B — Public Consumer Workflow (Post-Publication on npm)

Once `agboss@0.1.0` and `agboss-cli@0.1.0` are published to npm, any example directory can be cloned and installed directly from the registry without checking out the framework source tree:

```bash
cd 01-hello-agboss
npm install
npm run check     # Static graph analysis (agboss check) + TypeScript + ESLint
npm test          # Deterministic offline unit & workflow tests ($0, no API key)
npm run demo      # Local offline demonstration
```

---

## 5. Common Project Commands

Every example project exposes a consistent command contract:

| Command | Description | Requires API Key? |
| :--- | :--- | :--- |
| `npm run check` | Static graph verification (`agboss check`) and TypeScript typechecking | No (`$0`) |
| `npm test` | Deterministic offline unit, integration, and failure-injection tests | No (`$0`) |
| `npm run demo` | Reproducible local demonstration of the project's proofs | No (`$0`) |
| `npm run demo:live` | Optional live execution via OpenRouter (`OPENROUTER_API_KEY` in `.env`) | Yes |

---

## 6. Contributing & Security

- See [CONTRIBUTING.md](./CONTRIBUTING.md) for issue workflow, branching, and verification rules.
- See [SECURITY.md](./SECURITY.md) for responsible vulnerability reporting (`security@agboss.dev`).
- Licensed under the [Apache License 2.0](./LICENSE). Copyright 2026 [Pavel Ravvich](https://github.com/pavelravvich).
