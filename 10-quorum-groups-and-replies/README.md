# `10-quorum-groups-and-replies` — Quorum Groups, Branch Verdicts and Free-Text Approvals

> **Priority:** P1 — parallel reviews decided by arbiters, and a person in the loop who writes words, not JSON
> **Principle:** Promise → Failure Injection → Reproducible Proof

A purchasing desk. A team asks to buy 12 laptops from a supplier; **four reviews run at once** —
legal, compliance, price, budget — in **two quorum groups**. Every answer passes a **chain of
arbiters** before it counts: a code arbiter first (does the review cite what it rests on?), then
`anyOf(code, model)` (within the policy's thresholds? if not, does a decision model still accept
it?). Each branch's **verdict** is recorded. The first complete group by priority goes on: legal +
compliance (priority 1) to the order, price + budget (priority 2) to a deferral; neither in time →
the rejected finish. The order **waits for an approver** on a channel; the approver answers in free
text ("ok but only up to $500") and a `@ReplyInterpreter` turns the words into a typed decision
before anything resumes — an unreadable reply resumes nothing. A second workflow raises a budget
line by asking its owner a **typed question** (a question role, `.toQuestion(BudgetOwnerQuestion)`):
the owner's free-text reply is read by code into a typed answer; a limit below the request asks
again, at most `maxVisits` times.

```
purchase-request-workflow-start
  └→ legal-review ‖ compliance-review ‖ price-benchmark ‖ budget-check        (parallel)
       .acceptedBy(well-formed-review-arbiter)                               (code: cites a clause / source / line)
       .acceptedBy(anyOf(policy-threshold-arbiter, policy-judgement-arbiter)) (code first; Jev only when code rejects)
       .joinQuorumGroups(
          group(legal, compliance).priority(1) → purchase-order-agent ── place-purchase-order-tool
                                                     │   ⏸ purchase-approver-channel (free text → purchase-reply-interpreter)
                                                     └→ purchase-ordered-workflow-finish
          group(price, budget).priority(2)     → defer-purchase-action → purchase-deferred-workflow-finish
          { deadline: 2 min })
       .onJoinError(QuorumNotReachedError → purchase-rejected-workflow-finish)

budget-raise-request-workflow-start
  └→ ⏸ budget-owner-question (free text → budget-owner-reply-interpreter, code; maxVisits 2)
       .onError(QuestionFailedError → budget-raise-unasked-workflow-finish)
       └→ check-budget-raise-action ─┬→ budget-raised-workflow-finish
                                     └→ budget-owner-question again
                                          .onError(VisitsLimitExceededError → budget-raise-unresolved-workflow-finish)
```

## 1. Engineering Promises Tested

| Promise | Threat / Failure Injected | AGBoss Mechanism | Executable Proof |
|---|---|---|---|
| **The first complete group by priority goes on, the rest is cancelled** | Waiting for every review when two decide; a lower-priority group winning a race | `.toParallelAgents(…)` + `.joinQuorumGroups(group(…).priority(n)…, { deadline })`; `result.launches[0].group`, `BranchStatus.Cancelled` | [`tests/workflows/supplier-purchase/supplier-purchase.workflow.test.ts`](./tests/workflows/supplier-purchase/supplier-purchase.workflow.test.ts) › "group 1 … counts first", › "group 2 completes first, yet group 1 (priority 1) still goes on" |
| **When the groups disagree, the record says who rejected what** | The compliance review cites no clause (failure injection 1) | `@Arbiter({ decidedBy: DecidedBy.Code })` with one `@OnAnswer` per agent → `BranchVerdict.Rejected` with `rejectedBy`; group 1 cannot complete, group 2 goes on | › "AC2: a compliance answer without a clause is Rejected by well-formed-review-arbiter, and group 2 continues to purchase-deferred-workflow-finish", `npm run demo` (part 2) |
| **The model arbiter is asked only when the code rejects** | Paying a model for answers code already accepts | `.acceptedBy(anyOf(PolicyThresholdArbiter, PolicyJudgementArbiter))` stops at the first that accepts; the model's decision is paid under `arbiter:policy-judgement-arbiter` | › "AC2: the model arbiter is asked only when the threshold arbiter rejects", › "every review within the thresholds: the model arbiter is never asked", › "the model arbiter declines too …", [`tests/arbiters/`](./tests/arbiters/) (every `@OnAnswer` path, `testArbiter`) |
| **No group in time ends on a defined finish** | Both groups fail; the reviews hang past the deadline | `QuorumNotReachedError` → `.onJoinError(…, toFinish(PurchaseRejectedWorkflowFinish))`; the deadline on the test's `VirtualClock` | › "AC2: both groups failing ends at purchase-rejected-workflow-finish", › "no group complete in 2 minutes" |
| **A free-text approval becomes a typed decision, then the run resumes** | The approver writes "ok but only up to $500" | `@ChannelRole({ approves, answeredBy: PauseAnswerer.Channel, replyInterpreter })` + `app.resume({ pauseId, reply })` → `@ReplyInterpreter` (a chat model) → `ToolCallApprovalDecisionDto` with `overrideArguments`: the tool runs at $500 | [`tests/workflows/supplier-purchase/purchase-approval.workflow.test.ts`](./tests/workflows/supplier-purchase/purchase-approval.workflow.test.ts) › "AC3: 'ok but only up to $500' resumes with the amount capped at 500, and the order is capped", › "a plain approval keeps the amount asked", › "AC3: a refusal reply ends without an order" |
| **An unreadable reply never resumes the run** | The approver answers "🤷" (failure injection 2); a decision outside the tool's schema; an empty reply | `UninterpretableReplyError` (`pause.uninterpretable-reply`), the pause stays `PauseStatus.Pending` — the approver is asked again; an empty reply is `DtoValidationError` before the model is asked | › "AC3: an unreadable reply rejects with UninterpretableReplyError, the pause stays pending, and a second reply resumes", › "an invalid decision … is unreadable too", › "an empty reply is refused before the interpreter is asked", `npm run demo` (part 3) |

| **A question role asks a typed question and puts the typed answer on the path** | A person answers in words; a `PendingPause` read without its kind | `@ChannelRole({ ask, answer, answeredBy, replyInterpreter, maxVisits })` + `.toQuestion(Role)`; `result.pending[i].kind === PauseKind.Question`, `step` the question, its `ask` opaque until narrowed (an approval's `ask.arguments` is typed only after `kind === PauseKind.Approval`); the record's `kind` stored | [`tests/workflows/budget-raise/budget-raise.workflow.test.ts`](./tests/workflows/budget-raise/budget-raise.workflow.test.ts) › "the run pauses on the question …", › "'up to $2,000' is read into the typed answer and the line is raised", › "an unreadable reply leaves the question pending …", `npm run demo` (part 4) |
| **A question asked too often, or that cannot be asked, ends on a finish of its own** | The owner never covers the request (failure injection 3); the owners' inbox is down (failure injection 4) | `maxVisits: 2` → `VisitsLimitExceededError` before a third ask → `.onError(…)`; a `send` that throws → `QuestionFailedError` (`step.question`, `question`) → `.onError(…)` | › "maxVisits: asked twice below the request …", › "a channel that throws is QuestionFailedError …" |

## 2. Project Layout

- [`src/supplier-purchase.application.ts`](./src/supplier-purchase.application.ts) — `@Application`: the workflow, the model providers, the approvers' channel (transport is infrastructure, listed here), SQLite for the ledger, the pauses and the checkpoints.
- [`src/workflows/supplier-purchase/`](./src/workflows/supplier-purchase/) — the flow, its start and three finishes; [`src/workflows/budget-raise/`](./src/workflows/budget-raise/) — the question role's flow, its start and three finishes.
- [`src/agents/`](./src/agents/) — the four reviewers and `purchase-order`, each `<name>.agent.ts` + `<name>.prompt.md`.
- [`src/arbiters/`](./src/arbiters/) — `well-formed-review` and `policy-threshold` (code), `policy-judgement` (Jev).
- [`src/channels/`](./src/channels/) — the role `PurchaseApproverChannel` and its one implementation `ConsoleApproverChannel`; the question role `BudgetOwnerQuestion` and `InboxBudgetOwnerChannel`; [`src/services/`](./src/services/) — the stand-ins for the approvers' and the budget owners' chat apps.
- [`src/reply-interpreters/`](./src/reply-interpreters/) — the purchase reply interpreter (a model) and its prompt; the budget owner's (code).
- `src/tools/`, `src/actions/`, `src/dto/`, `src/budgets/`, `src/environments/`, `src/model-providers/` — one kind per folder.
- [`src/demo.ts`](./src/demo.ts) — `npm run demo` / `npm run demo:live`; [`fixtures/offline-openrouter.ts`](./fixtures/offline-openrouter.ts) — the demo's scripted OpenRouter (tests script models with `mockLlm` instead).
- `tests/` mirrors `src/`.

## 3. Commands

```bash
npm install
npm run check     # agboss check + tsc + eslint (also syncs .claude/skills/agboss)
npm test          # every group, verdict, arbiter path and reply, models scripted, $0
npm run demo      # offline: no network, no key
npm run demo:live # real models through OpenRouter (OPENROUTER_API_KEY), a fraction of a cent
```

`npm run demo` prints, from each execution's state (`result.launches`, `result.toolCalls`, the pause
store):

1. the verdict of every branch and the winning group (legal + compliance), the approver's free-text
   cap and the tool call it ran — at $500;
2. the disagreement: the compliance review `Rejected` by `well-formed-review-arbiter`, price + budget
   winning, the deferred finish;
3. "🤷" → `UninterpretableReplyError` with the pause still `pending`, then a readable reply that
   finishes the order;
4. the budget raise paused on its question (`kind` `question`), "up to $500" asking again, "fine, up
   to $2,000" raising the line — the owner asked exactly twice.

The demo checks each of these and exits non-zero when one does not hold. Offline, the scripted
OpenRouter reports nominal costs; nothing is spent. Live, every model is real
(`openai/gpt-4.1-nano` for the reviewers, `openai/gpt-4o-mini` for the order agent and the reply
interpreter, Jev for the model arbiter); part 2's compliance reviewer is scripted even then (the
failure injection).

## 4. Guarantee Boundary

- **An arbiter decides whether an answer counts, not whether it is true.** The code arbiters check
  what code can check — a citation present, a number at or above zero (`remainingUsd`, never the
  model's own "affordable" flag: a cheap model said $1,200 "exceeds" $10,000); the model arbiter's
  judgement is a model's.
- **"Unreadable" is the interpreter's call.** The framework guarantees that a reply its interpreter
  does not turn into a valid decision resumes nothing; whether "🤷" is read as no decision or as a
  refusal is the model's — the prompt says so explicitly, and cheap models without that line read
  "🤷" as a refusal.
- **The order agent's report is a model's.** The proof reads the tool call that ran
  (`result.toolCalls`), not the agent's sentence about it.
- **The approver's identity is the channel's.** `PauseAnswerer.Channel`: the pause id never reaches
  the caller (`result.pending` has none); whoever holds it on the channel's side may answer.
