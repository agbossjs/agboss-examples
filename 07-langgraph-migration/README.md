# `07-langgraph-migration` — Side-by-Side Comparison: Raw LangGraph (`before-langgraph/`) vs AGBoss (`after-agboss/`)

This example shows the exact same customer-support refund graph implemented twice:
1. **`before-langgraph/`** — Conventional `@langchain/langgraph` implementation with a 15-field `Annotation.Root` God State, string-keyed conditional edges, unbounded `Send()` fan-out, and dynamic prompt string interpolation.
2. **`after-agboss/`** — The migrated AGBoss implementation (`after-agboss/src/` + `after-agboss/tests/`) where every LangGraph anti-pattern is replaced by a compile-time and `agboss check`-verified architectural primitive.

---

## 1. What Breaks in `before-langgraph/` → How `after-agboss/` Solves It

| How it is written in `before-langgraph/` | What breaks in production | How it is solved in `after-agboss/` |
|---|---|---|
| **15-field `Annotation.Root` God State** ([`before-langgraph/support.graph.ts`](./before-langgraph/support.graph.ts)) | Every node can read/write any field; `write` reads `state.draft` and `state.critique` on its very first visit when both are `undefined` (`"Draft: undefined"`), and `unusedDebugNote` is persisted forever without any consumer. | **10 narrow edge DTOs** in [`after-agboss/src/dto/`](./after-agboss/src/dto/) + **static Path Scope verification** (`agboss check`). `ReplyWriterAgent` (first draft) and `ReplyEditorAgent` (revisions requiring `ChangesRequestedDto`) are distinct nodes with exact input contracts. |
| **String-keyed `addConditionalEdges`** (`"plan" \| "handOver"`, `"write" \| "routeBySize"`) | Typos in edge target strings, missing branch handlers, or unbounded review loops silently fail or spin forever at runtime. | **Typed `@Router` & discriminated `.switch()`** ([`support-triage.router.ts`](./after-agboss/src/routers/support-triage/support-triage.router.ts) `DecidedBy.Model`, [`refund-size.router.ts`](./after-agboss/src/routers/refund-size/refund-size.router.ts) `DecidedBy.Code` at $0) + `maxVisits` loop guard routing `VisitsLimitExceededError` to [`ReplyStuckWorkflowFinish`](./after-agboss/src/workflows/support/reply-stuck.workflow-finish.ts). |
| **Unbounded `new Send("research", ...)` fan-out** with manual reducer array concatenation | A hallucinating planner can spawn 100 parallel LLM calls with no concurrency cap or item limit. | **Bounded `.toParallelAgents(OrderResearcherAgent, { maxConcurrency: 3, maxItems: 5 }).join()`** in [`support.workflow.ts`](./after-agboss/src/workflows/support/support.workflow.ts). |
| **Side effects inside graph nodes & untyped `interrupt()`** | Side effects lack deterministic step idempotency keys, and `interrupt()` resumes with untyped `any` payloads. | **Idempotent `@Action` & typed `@Channel` HITL pauses** ([`issue-refund.action.ts`](./after-agboss/src/actions/issue-refund.action.ts), [`issue-signed-off-refund.tool.ts`](./after-agboss/src/tools/issue-signed-off-refund.tool.ts), [`supervisor-queue-refund-sign-off.channel.ts`](./after-agboss/src/channels/supervisor-queue-refund-sign-off.channel.ts)). |
| **Dynamic string interpolation inside system prompts** (`\`Reply fixing: ${state.critique}\``) | Mutating the system prompt on every turn invalidates provider prompt KV-caching and mixes untrusted user data into system instructions. | **Immutable `.prompt.md` files** co-located with each agent in [`after-agboss/src/agents/<name>/`](./after-agboss/src/agents/) while structured runtime inputs flow strictly through typed user messages. |

---

## 2. Project Layout

```text
07-langgraph-migration/
  ├── before-langgraph/
  │   └── support.graph.ts                              # Raw 15-field LangGraph God State & latent bugs
  ├── after-agboss/
  │   ├── src/
  │   │   ├── support.application.ts                    # @Application root
  │   │   ├── demo.ts                                   # Runs before-langgraph vs after-agboss comparison
  │   │   ├── workflows/support/                        # SupportWorkflow + Start + 3 Finishes
  │   │   ├── agents/<name>/                            # 6 agents, each in its own folder with .prompt.md
  │   │   ├── routers/<name>/                           # SupportTriageRouter (Model) & RefundSizeRouter (Code)
  │   │   ├── actions/                                  # IssueRefundAction
  │   │   ├── tools/                                    # OrderLookupTool & IssueSignedOffRefundTool
  │   │   ├── channels/                                 # RefundSignOffChannel + SupervisorQueue implementation
  │   │   ├── services/                                 # OrderBookService, RefundApiService, SupervisorQueueService
  │   │   └── dto/                                      # 10 narrow edge DTOs (1 class = 1 file)
  │   └── tests/                                        # Symmetric unit & workflow tests mirroring src/
  │       ├── actions/issue-refund.action.test.ts
  │       ├── routers/refund-size/refund-size.router.test.ts
  │       └── workflows/support/support.workflow.test.ts
  └── README.md
```

## 3. Commands

```bash
npm run check   # Validates SupportWorkflow graph, Path Scope, prompts, TypeScript & ESLint
npm test        # Runs isolated unit tests + full workflow migration acceptance suite
npm run demo    # Runs side-by-side before-langgraph vs after-agboss comparison
```

## 4. Guarantee Boundary & Benchmark Scope

This project is a **deterministic before/after reference showcase**: it runs the pre-written `before-langgraph/support.graph.ts` and `after-agboss/src/` implementations side by side in offline mode (`$0`, no external LLM keys) and proves that the AGBoss architecture eliminates the 15-field God State, untyped string edges, unbounded fan-out, and dynamic system prompt interpolation.

An **unassisted live coding-agent migration benchmark** (measuring an external LLM coding agent's multi-attempt success rate when migrating `before-langgraph/` from scratch using `.claude/skills/agboss/references/13-migrating-from-langgraph.md`) requires live paid LLM API execution and is documented as **not yet verified** in offline CI.
