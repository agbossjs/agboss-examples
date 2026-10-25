# `06-enterprise-agent-mesh` — Multi-Service A2A, MCP, Ed25519 Envelopes, Loop Guard & Federation Blast Radius

## 1. Architecture Diagram & Microservice Topology

```text
                       ┌─────────────────────────────────────────────────┐
                       │  apps/1-order-gateway/src/                      │
  HTTP / CLI Request ──▶  TriageGatewayApplication                       │
                       │  workflows/triage/triage.workflow.ts            │
                       │    └── TriageAgent                              │
                       │          ├── SearchCatalogTool (@McpTool)       │
                       │          └── AskBillingTool (@Tool -> @A2AAgent)│
                       └───────────┬─────────────────────────┬───────────┘
                                   │                         │
            MCP (JSON-RPC +        │                         │ A2A (HTTP + Bearer Auth +
            _meta.callId +         │                         │ Ed25519 agboss-mesh JWS)
            agboss.dev/mesh JWS)   ▼                         ▼
┌──────────────────────────────────────────┐   ┌──────────────────────────────────────────┐
│  apps/3-catalog-mcp/src/                 │   │  apps/2-billing-a2a/src/                 │
│  CatalogApplication                      │   │  BillingApplication                      │
│  mcp/catalog.mcp-expose.ts (@McpExpose)  │   │  a2a/billing.a2a-expose.ts (@A2AExpose)  │
│    ├── LookupSkuTool                     │   │    └── workflows/billing/                │
│    └── workflows/catalog/                │   │          └── ResolveBillingInquiryAction │
└──────────────────────────────────────────┘   └──────────────────────────────────────────┘
```

## 2. Three Core Engineering Guarantees Proven

1. **Ed25519 Mesh Envelope + Infinite Loop / Hop Protection (`MeshLoopDetectedError`, `HopsLimitExceededError`):**
   - Every cross-service call carries a signed `agboss-mesh` Ed25519 JWS envelope recording `origin`, `callChain`, and `bodyHash`.
   - Forged signatures are rejected before execution with `401 mesh.signature-invalid`.
   - Cyclic calls (`A → B → A`) throw `MeshLoopDetectedError`, and call chains exceeding `maxMeshHops: 3` throw `HopsLimitExceededError`. `TriageWorkflow` catches both deterministically via `.onError(...)` and routes to `MeshLoopFallbackWorkflowFinish`.
2. **Idempotent Deduplication of MCP Tool Calls (`_meta.callId`):**
   - When `1-order-gateway` invokes `lookup-sku-tool` on `3-catalog-mcp` and retries with the same `_meta.callId`, `SqliteMeshRequestRepository` deduplicates the call and returns the cached result without re-running `CatalogInventoryService`.
3. **Static Cross-Service Contract Verification (`agboss check --federation`):**
   - `federation/` holds exported contract snapshots (`agboss describe --json`) for all 3 microservices.
   - If `2-billing-a2a` introduces a breaking DTO change (e.g., adding a required `accountRegion` field to `BillingInquiryDto`) or `3-catalog-mcp` removes an exported MCP tool, `agboss check --federation` fails at CI time (`federation.incompatible-schema`, `federation.missing-target`) and prints the exact consumer blast radius (`triage-gateway-application › triage-workflow`).

## 3. Project Layout

```text
06-enterprise-agent-mesh/
  ├── apps/
  │   ├── 1-order-gateway/src/          # Gateway service calling service 2 via A2A and service 3 via MCP
  │   ├── 2-billing-a2a/src/            # Remote billing microservice (@A2AExpose)
  │   └── 3-catalog-mcp/src/            # Remote product catalog microservice (@McpExpose)
  ├── federation/                       # Contract snapshots for `agboss check --federation` & `agboss hub show`
  └── tests/                            # Symmetric unit and multi-service mesh integration tests
      ├── actions/resolve-billing-inquiry.action.test.ts
      └── workflows/triage/triage.workflow.test.ts
```

## 4. Commands

```bash
npm run check   # Validates all 3 microservice applications + TypeScript + ESLint
npm test        # Runs unit + multi-service A2A, MCP, loop, and federation tests
npm run demo    # Runs live loopback A2A + federation blast-radius proof
```
