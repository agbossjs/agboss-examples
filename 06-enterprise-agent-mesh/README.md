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
            MCP (JSON-RPC +        │                         │ A2A v1.0 (Agent Card +
            _meta.callId +         │                         │ JSON-RPC + Bearer Auth)
            agboss.dev/mesh JWS)   ▼                         ▼
┌──────────────────────────────────────────┐   ┌──────────────────────────────────────────┐
│  apps/3-catalog-mcp/src/                 │   │  apps/2-billing-a2a/src/                 │
│  CatalogApplication                      │   │  BillingApplication                      │
│  mcp/catalog.mcp-endpoint.ts (@McpEndpoint)│   │  a2a/billing.a2a-endpoint.ts (@A2AEndpoint)│
│    ├── LookupSkuTool                     │   │    └── workflows/billing/                │
│    └── workflows/catalog/                │   │          └── ResolveBillingInquiryAction │
└──────────────────────────────────────────┘   └──────────────────────────────────────────┘
```

## 2. Three Core Engineering Guarantees Proven

1. **Ed25519 Mesh Envelope + Infinite Loop / Hop Protection (`LimitError.MeshLoop`, `LimitError.Hops`):**
   - A call to the catalog over MCP carries a signed Ed25519 JWS envelope (`_meta["agboss.dev/mesh"]`) recording `origin`, `callChain`, and `bodyHash`; the catalog refuses a forged signature before anything runs (`mesh.signature-invalid`), a chain that already passed through its tool (`limit.mesh-loop`) and one of `@Mesh({ maxHops: 3 })` hops (`limit.hops`).
   - The billing call goes over A2A v1.0 (the billing server's Agent Card and its JSON-RPC binding; the client discovers the card and calls the `billing-workflow-start` skill). The card declares the AGBoss mesh extension (`https://agboss.dev/a2a/mesh/v1`) and the skills extension, so the call carries the envelope in `message.metadata` (`A2AMesh.Required`) and gets back billing's signed run report. `tests/a2a/billing-a2a.test.ts` fetches the card, calls billing with the official SDK client (`ClientFactory`), and shows billing's receiver refusing a forged signature (`401 mesh.signature-invalid`), a loop (`limit.mesh-loop`) and the hop limit (`limit.hops`) as `REJECTED` tasks.
   - A billing call refused as a loop (`LimitError.MeshLoop`) is caught by `TriageWorkflow` deterministically via `.onError(...)` and routed to `MeshLoopFallbackWorkflowFinish`.
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
  │   ├── 2-billing-a2a/src/            # Remote billing microservice (@A2AEndpoint, @HttpAuthenticator)
  │   └── 3-catalog-mcp/src/            # Remote product catalog microservice (@McpEndpoint, served by `mcpHttpListener`)
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
npm run demo:stream   # Live only (OPENROUTER_API_KEY, skips with a message without it): the invoice review streams over A2A
```

## 5. Streaming and files over A2A (the invoice review)

Billing has a second skill, `invoice-review-workflow-start` (`apps/2-billing-a2a/src/workflows/invoice-review/`):
the caller sends a question as a data part and the invoice as a `text/csv` file part; `InvoiceReviewerAgent`
reads the file (`ModelFiles`, `FileView.Original`: a CSV is text) and answers in plain text, which a judge
(`InvoiceReplyJudge`, a second model of another vendor) checks before it is let through. A message that names
no skill still runs the original `billing-workflow-start` (`defaultSkill`). The review's limits are on the
workflow's `@FilePolicy`: one CSV, 8 KB (`InvoiceReviewFilePolicy`). Offline, a stand-in model
(`InvoiceReviewerOfflineModelProvider`, a transport with `stream()`) works the item count and total out of
the CSV text the framework shows the model and answers word by word; `billing.live.app.ts` puts OpenRouter in its place.

| What it proves | Test |
| --- | --- |
| over `message/stream` (SSE) the task is announced first, the answer arrives as chunks of the task's output artifact while it is still `WORKING`, and `COMPLETED` is last | `tests/a2a/billing-invoice-review.test.ts`, `tests/a2a/billing-invoice-stream.test.ts` |
| the answer streams token by token (many chunks, the first `append: false`, the rest `append: true`), and the text shown is the answer once | `tests/a2a/billing-invoice-stream.test.ts` |
| nothing but the answer is streamed (#1004): the judge's model ran, and its words are in no chunk and no status | `tests/a2a/billing-invoice-review.test.ts` |
| the invoice sent as a file part reaches the agent's model as the CSV's own text; the answer follows the file (a second invoice, a second total) | both |
| the gateway-side typed `A2AClient` sends the invoice with `A2AClientFile.fromBytes` and gets the text answer | `tests/a2a/billing-invoice-review.test.ts` |
| the door refuses a PNG (`a2a.file-media-type`), a file over 8 KB (`a2a.file-too-large`), bytes that are no text called a CSV (`a2a.media-type-mismatch`) and a file descriptor in a data part (`a2a.file-field-in-data`), and the model is never called | same |

