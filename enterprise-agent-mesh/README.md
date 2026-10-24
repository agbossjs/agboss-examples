# `enterprise-agent-mesh` — A2A, MCP, Ed25519 Mesh Envelopes & Federation Blast Radius

> **Priority:** P1 — Advanced Distributed Mesh Proof  
> **Principle:** Promise → Failure Injection → Reproducible Proof

## 1. Engineering Promises Tested

| Promise | Threat / Failure Injected | AGBoss Mechanism | Executable Proof |
|---|---|---|---|
| **Host-controlled A2A authentication & tenant isolation** | Caller sends no Bearer key or attempts to spoof tenant identity | `@A2AExpose` + `a2aHttpListener` + `A2ACallerResolver` (`A2ACallerResolution.unauthenticated` / `.resolved`) | [`tests/a2a-contract-and-auth.test.ts`](./tests/a2a-contract-and-auth.test.ts) |
| **Cryptographic mesh identity, loop detection & hop limits** | Attacker forges Ed25519 `agboss-mesh` signature, or cyclic A→B→A / deep hop chains occur | `@Application({ mesh: { signingKey, peers }, maxMeshHops })`, `MeshLoopDetectedError`, `HopsLimitExceededError` | [`tests/mesh-loop-and-hops.test.ts`](./tests/mesh-loop-and-hops.test.ts) |
| **Idempotent MCP tool execution across retries** | Network retry resends `tools/call` with the same `_meta.callId` | `@McpExpose` + `createMcpService` + `SqliteMeshRequestRepository` deduplication | [`tests/mcp-idempotency.test.ts`](./tests/mcp-idempotency.test.ts) |
| **Cross-repo contract verification & Blast Radius** | Producer (`billing-application` / `catalog-application`) ships breaking DTO changes or drops an MCP tool | `agboss describe --json` + `agboss check --federation <dir>` (`[federation.incompatible-schema]`, `[federation.missing-target]`) + `agboss hub show` | [`tests/federation-blast-radius.test.ts`](./tests/federation-blast-radius.test.ts) |

## 2. Architecture

- [`triage-gateway/triage.application.ts`](./triage-gateway/triage.application.ts) — `TriageGatewayApplication` consuming `BillingA2AAgent` (`@A2AAgent`) and `CatalogMcpServer` (`@McpServer` / `@McpTool`), with `.onError(MeshLoopDetectedError, ...)` and `.onError(HopsLimitExceededError, ...)`.
- [`billing-service/billing.application.ts`](./billing-service/billing.application.ts) — `BillingApplication` exposing `BillingWorkflowStart` via `@A2AExpose` with `BillingA2aCallerResolver` and `maxMeshHops: 3`.
- [`catalog-mcp/catalog.application.ts`](./catalog-mcp/catalog.application.ts) — `CatalogApplication` exposing `LookupSkuTool` and `CatalogWorkflowStart` via `@McpExpose`.
- [`federation/verify-federation.ts`](./federation/verify-federation.ts) — Compares `agboss describe --json` snapshots in [`federation/snapshots/compatible/`](./federation/snapshots/compatible) and [`federation/snapshots/breaking/`](./federation/snapshots/breaking) and stitches the mesh via `agboss hub show --json`.

## 3. Commands

```bash
npm run check   # Static verification across all 3 applications + TypeScript + ESLint
npm test        # Run all 4 executable proof suites
npm run demo    # Run deterministic offline mesh + federation proof
```
