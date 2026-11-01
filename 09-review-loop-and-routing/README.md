# `09-review-loop-and-routing` — Code Routing vs Model Routing, and a Bounded Review Loop

> **Priority:** P0 — two everyday DSL tools side by side, small and fast
> **Principle:** Promise → Failure Injection → Reproducible Proof

A bank's credit desk. One application, one workflow (`credit-review-workflow`) with **two starts**:
the same credit application is routed **by code** through one (`CreditLimitCodeRouter`, the bank's
thresholds — no model, $0) and **by a decision model** through the other (`CreditIntentModelRouter`,
Jev — one paid decision). Both lead onto the same two routes and into the same **review loop**: an
analyst writes a memo, a risk officer reviews it and requests changes or approves it, an editor
rewrites it — reading the current memo and at most two earlier ones — until the officer approves or
the editor's visits run out and the application goes to the credit committee.

```
code-routed-credit-workflow-start  → credit-limit-code-router   (code, $0) ─┐
model-routed-credit-workflow-start → credit-intent-model-router (Jev)     ─┤
                                                                            ├→ credit-declined-workflow-finish
                                                                            └→ credit-analyst-agent
                                                                                  ↓ CreditMemoDto
                       ┌──────────────────────────────────────────────→ risk-officer-agent (maxVisits 4)
                       │                                        changes ↙              ↘ approved
                       │   memo-editor-agent (maxVisits 3, historyOf(CreditMemoDto, { limit: 2 }))   credit-approved-workflow-finish
                       └──── CreditMemoDto ─────┘
                                 └ VisitsLimitExceededError → escalate-to-committee-action → credit-escalated-workflow-finish
```

**When to pick which router.** A decision your code can make — thresholds, a lookup, a rule a
regulator wrote down — belongs in a `DecidedBy.Code` router: no tokens, no latency, no variance, and
a unit test per edge. A decision that needs judgement over free text (the applicant's purpose, an
e-mail, a ticket) is a `DecidedBy.Model` router. Both are checked the same way: the flow's routes
must be the router's routes.

## 1. Engineering Promises Tested

| Promise | Threat / Failure Injected | AGBoss Mechanism | Executable Proof |
|---|---|---|---|
| **A code router decides at $0, on the same routes a model router would** | Paying a model for a decision three `if`s make; a code path that drifts from the model path | `@Router({ decidedBy: DecidedBy.Code })` + `route(input)` returning `Route<Self>` (a target outside `routes` does not compile) beside `@Router({ decidedBy: DecidedBy.Model, model: "typesafe/jev-1.13" })`; two starts of one workflow onto the same `chooseOne` | [`tests/routers/credit-limit-code/credit-limit-code.router.test.ts`](./tests/routers/credit-limit-code/credit-limit-code.router.test.ts) › "AC2: …" (every threshold at its edge: 599/600, 0.45/0.46, 250 000/250 001; 0 calls, $0), [`tests/workflows/credit-review/credit-review.workflow.test.ts`](./tests/workflows/credit-review/credit-review.workflow.test.ts) › "AC2: both starts route the same application the same way; the code router's spend is $0", › "AC2: a declined application stops at the declined finish on both starts" |
| **The model router's decision is paid and accounted** | A routing cost nobody sees | `result.spend.byCaller["router:credit-intent-model-router"]`, `byCategory.routing`, the step's own `spend` in `result.record.steps` | [`tests/routers/credit-intent-model/credit-intent-model.router.test.ts`](./tests/routers/credit-intent-model/credit-intent-model.router.test.ts), the workflow test above, `npm run demo` (table 1) |
| **A missing route is caught before anything runs** | A model router whose flow forgets a route: the model picks it, the run has no path | `agboss check` → `[router.routes-mismatch]`, a non-zero exit, naming the missing route | [`tests/fixtures/missing-route.test.ts`](./tests/fixtures/missing-route.test.ts) on [`fixtures/missing-route/`](./fixtures/missing-route/) (an isolated negative fixture, R5) |
| **A review loop ends on a defined finish** | A critic that never accepts: the loop rewrites forever, the cost grows | `maxVisits` on the loop's agents; `.onError(VisitsLimitExceededError, toAction(EscalateToCommitteeAction).toFinish(CreditEscalatedWorkflowFinish))` — the editor's 4th visit is refused before its model call; `maxSteps: 9` holds the loop's worst case | [`tests/workflows/credit-review/credit-review.workflow.test.ts`](./tests/workflows/credit-review/credit-review.workflow.test.ts) › "AC3: a critic that never accepts ends at credit-escalated-workflow-finish after 3 editor visits", › "AC3: the stubborn critic escalates on the model-routed start too", `npm run demo` (part 2) |
| **What the editor reads stays bounded** | The prompt grows with every round of the loop | `historyOf(CreditMemoDto, { limit: 2 })` → `{ current, previous }`: the newest memo and at most two earlier ones (the latest two, oldest first) | › "AC3: the editor reads the current memo and at most two earlier ones" (visit 1: none, visit 2: one, visit 3: two) |
| **A rewrite outdates the request it answered** | The officer's old notes read as if they were about the new memo | `caseOf(MemoChangesRequestedDto, { about: CreditMemoDto })`: the editor's memo outdates the request (`result.record.outdatedValues`) | › "a request for changes is about the memo: a rewrite outdates it, the officer reads the new memo" |
| **Approval at any round, also the last** | An approval on the editor's last visit escalated by mistake | the officer's `switch` is its own path, reached from the analyst and the editor | › "approved at once", › "approved after one round", › "approved on the editor's last visit (visit 3): no escalation" |

## 2. Project Layout

- [`src/credit-review.application.ts`](./src/credit-review.application.ts) — `@Application`: the workflow, the OpenRouter and Decisions model providers, the cost ledger, three budgets.
- [`src/workflows/credit-review/`](./src/workflows/credit-review/) — `credit-review.workflow.ts` (the flow), its two starts and three finishes.
- [`src/routers/credit-limit-code/`](./src/routers/credit-limit-code/) — the code router; [`src/routers/credit-intent-model/`](./src/routers/credit-intent-model/) — the model router.
- [`src/agents/`](./src/agents/) — `credit-analyst`, `risk-officer`, `memo-editor`, each `<name>.agent.ts` + `<name>.prompt.md`.
- [`src/actions/escalate-to-committee.action.ts`](./src/actions/escalate-to-committee.action.ts) — the loop's defined way out (code, no model).
- `src/dto/`, `src/budgets/`, `src/environments/`, `src/model-providers/` — one kind per folder.
- [`src/demo.ts`](./src/demo.ts) — `npm run demo` / `npm run demo:live`.
- [`fixtures/offline-openrouter.ts`](./fixtures/offline-openrouter.ts) — the demo's offline OpenRouter (chat completions and the Decisions API, scripted, behind `createApp({ providerFetch })`) and the live demo's stubborn critic; tests never use it (they script models with `mockLlm`).
- [`fixtures/missing-route/`](./fixtures/missing-route/) — the negative fixture.
- `tests/` mirrors `src/`.

## 3. Commands

```bash
npm install
npm run check     # agboss check + tsc + eslint (also syncs .claude/skills/agboss)
npm test          # every route, verdict and the loop's limits, models scripted, $0
npm run demo      # offline: no network, no key
npm run demo:live # real models through OpenRouter (OPENROUTER_API_KEY), a fraction of a cent
```

`npm run demo` prints, read from each execution's state (`result.path`, `result.spend`,
`result.record.steps`):

1. a table per start — the route, the router's calls, spend and wall time, the review rounds and the
   finish — for an application that passes the thresholds and one that does not: the same route
   either way, the code router at 0 calls and $0;
2. a run with a risk officer that never approves: its path, `credit-escalated-workflow-finish`, the
   editor's 3 model calls and its refused 4th visit.

The demo checks each of these and exits non-zero when one does not hold. Offline, the scripted
OpenRouter reports nominal costs so the accounting is visible; nothing is spent. Live, every agent
and the model router are real models (`google/gemini-2.5-flash-lite`, Jev); part 2's risk officer is
scripted even then (the failure injection), the rest of that run is real.

## 4. Guarantee Boundary

- **Routing agreement is a property of the rule, not of the model.** The code router's answer is
  exact; the model router is asked the same thresholds and usually agrees, but a decision model can
  misread a borderline application. When a rule can be written down, write it in code; the demo's
  live run shows the two agreeing on clear cases, not on every case.
- **`maxSteps` is ours to keep right.** `agboss check` bounds an explicit `maxSteps` by the shortest
  path only; the loop's worst case (9 agent and router steps here) is held by the AC3 test — a lower
  value would end the stubborn run with `MaxStepsExceededError` before the editor's limit takes it
  to the committee.
- **What the memo says is the model's.** The framework bounds the loop, validates every answer
  against its DTO and routes on the officer's typed verdict; whether a memo is any good is the
  officer's (a model's) judgement.
