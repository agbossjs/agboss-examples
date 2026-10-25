# `03-support-refund-desk` — Guardrails, PII Roundtrip, Tool Interception, In-Memory RAG & Evaluation Proofs

## 1. What this example proves

`03-support-refund-desk` proves that AGBoss enforces deterministic safety boundaries around LLM agents and provides a rigorous, statistically sound evaluation pipeline:

1. **Reversible PII Token Roundtrip & Boundary Refusal (`@PiiPolicy`, `revealPii`):**
   - Customer emails (`PiiKind.Email`) and custom ticket IDs (`support-ticket-id`) are replaced with HMAC-keyed tokens (`<email:d1ac5c>`) before any model call.
   - Tools marked with `revealPii: true` (`IssueRefundTool`) receive the real de-tokenized email for external side effects while all traces, execution records, and eval artifacts remain masked.
   - Raw payment card numbers (`PiiKind.CardNumber`) are refused at the boundary with `PiiRefusedError`.
2. **Pre-Execution Tool Interception & Guardrails (`@ToolInterceptor`, `@InputGuardrail`, `@OutputGuardrail`):**
   - `RefundPolicyToolInterceptor` intercepts over-cap refund attempts (`> $500`) with `ToolCallDecision.replyToModel(...)` so the model revises its decision to `"escalated"` with zero side effects on `OrderBookService`.
   - Cross-tenant order lookups are hard-blocked with `ToolCallDecision.block(...)` (`ToolBlockedError`).
   - `PromptInjectionGuardrail` (`DecidedBy.Code`, $0) blocks prompt injection before any model call; `UnauthorizedPayoutGuardrail` (`DecidedBy.Model`) blocks unverified legal settlement promises on output.
3. **In-Memory `@Rag` (`InMemoryKnowledgeIndexService` + `RefundPolicyRetriever`) & Memory Compaction vs. Policy Drift (`@Compaction`):**
   - `InMemoryKnowledgeIndexService` splits `fixtures/refund-policy-current.md` into 6 markdown sections (`[policy-window]`, `[policy-cap]`, `[policy-digital-licenses]`, `[policy-vip-restocking]`, `[policy-tenant]`, `[policy-citation]`) and ranks chunks using deterministic BM25/TF-IDF token overlap + citation boost.
   - `RefundPolicyRetriever` queries the top-K relevant sections and injects `RetrievedChunk[]` into `RefundPolicyRag` (`RagMode.Context`).
   - Across a 5-turn conversation (`uncompactedTurns: 2`, `turnsBetweenCompactions: 2`), `PolicyAwareCompaction` summarizes older turns while explicitly marking early v1.0 policy claims (`90 days / $2,000`) as superseded by active v2.0 policy (`30 days / $500`).
4. **5-Layer Evaluation, Compact Git Baseline & Judge Calibration (`@EvalSuite`, `agboss eval`):**
   - `RefundDeskEvalSuite` (`src/eval-suites/refund-desk.eval-suite.ts`) defines the quality gate executed by `npx agboss eval run` in CI/CD before deployment (`trajectory → code judge → model judge` with `EvalCascade.StopAtFirstFailure`).
   - Compact `eval/baseline/main-baseline.json` (`kind: "agboss.eval-baseline"`, `schemaVersion: 1`) stores only git-diff-friendly metrics (`caseId`, `caseHash`, `runs`, `passed`, `passAtK`, `passHatK`, `flaky`, `avgSpendUsd`, `verdictSummary`), while full per-run traces stay in `.agboss/eval/` (gitignored).
   - `pass@k` vs `pass^k` (`isUnstable: true`) and baseline comparison (`CaseComparison.FlakyOnBaseline` quarantined vs `CaseComparison.Regressed`).
   - Judge calibration (`agboss eval calibrate`) computing pairwise Cohen's $\kappa$, confusion matrices, and rubric disagreements against `eval/human-labels/refund-desk-eval-suite.jsonl`.

## 2. Quick start

```bash
npm run check
npm test
npm run demo
```

Individual scenario runners:

```bash
npm run demo:pii
npm run demo:policy
npm run demo:memory-drift
npm run demo:evals
```

## 3. Canonical `src/` & symmetric `tests/` layout

- `src/support-refund-desk.application.ts` — `SupportRefundDeskApplication` with `SupportOfflineModelProvider`, `CustomerContactPiiPolicy`, `AuditTrailToolInterceptor`, SQLite persistence, and multi-scope budgets.
- `src/workflows/support-refund/` — `support-refund.workflow.ts`, `support-refund.workflow-start.ts`, `support-refund.workflow-finish.ts`.
- `src/workflows/live-support-refund/` — `live-support-refund.workflow.ts`, `live-support-refund.workflow-start.ts`, `live-support-refund.workflow-finish.ts`.
- `src/contexts/` — `support-tenant.context.ts`, `support-execution.context.ts`.
- `src/dto/` — Narrow edge DTOs (`1 class = 1 file`).
- `src/services/in-memory-knowledge-index.service.ts` & `src/retrievers/refund-policy.retriever.ts` — Real in-memory BM25/TF-IDF section indexer and retriever injected into `src/rag/refund-policy.rag.ts`.
- `src/pii-policies/`, `src/guardrails/<name>/`, `src/interceptors/`, `src/compactions/<name>/`, `src/agents/<name>/`, `src/judges/<name>/`.
- `src/eval-suites/refund-desk.eval-suite.ts` & `eval/baseline/main-baseline.json` — Quality-gate suite and compact git-tracked baseline snapshot.
- `tests/` — Mirrors `src/` 1-to-1:
  - `tests/guardrails/prompt-injection/prompt-injection.guardrail.test.ts`
  - `tests/interceptors/refund-policy.interceptor.test.ts`
  - `tests/judges/citation-code/citation-code.judge.test.ts`
  - `tests/retrievers/refund-policy.retriever.test.ts`
  - `tests/workflows/support-refund/support-refund.workflow.test.ts` (including end-to-end Langfuse OTel collector span verification)

## 4. Failure / scenario matrix

| Scenario | Injected Threat / Condition | AGBoss Mechanism | Observable Proof |
|---|---|---|---|
| **A: PII Roundtrip & Refusal** (`scenarios/pii.ts`) | Raw email, ticket ID, and raw payment card number in customer message | `@PiiPolicy`, `PiiAction.replaceWithToken()`, `revealPii: true`, `PiiAction.blockWithRefusal()` | Model sees `<email:d1ac5c>`; `IssueRefundTool` receives `alice.synth@example.com`; card number throws `PiiRefusedError` |
| **B: Policy & Guardrails** (`scenarios/policy.ts`) | Over-cap `$1,450` tool call, cross-tenant lookup, prompt injection, and legal settlement promise | `@ToolInterceptor`, `@InputGuardrail`, `@OutputGuardrail` | Over-cap call gets `ToolCallStatus.Replied` and escalates; cross-tenant throws `ToolBlockedError`; guardrails throw `GuardrailBlockedError` |
| **C: Memory vs. Policy Drift** (`scenarios/memory-drift.ts`) | Customer cites superseded v1.0 90-day policy across 5 turns for 45-day-old `ORD-1003` | `PolicyAwareCompaction` + `RefundPolicyRag` (`RagMode.Context`) | Compaction preserves `ORD-1003` fact, strips stale v1.0 claim, and agent denies refund (`refundedUsd === 0`) |
| **D: 5-Layer Evaluation** (`scenarios/evals.ts`) | Flaky run (`1/2`), rubric ambiguity across human raters, chaos faults, and incident drafting | `agboss eval run --baseline`, `eval calibrate`, `--chaos`, `--metamorphic`, `generate eval-case` | `FlakyOnBaseline` quarantined; `Regressed` caught; $\kappa = 1.00$ (`anna`) / $0.57$ (`ben`); drafted case & HTML report contain zero raw PII |

## 5. How to reproduce each case

```bash
# Run all automated Vitest proofs
npm test

# Run CLI evaluation & save compact baseline
npx agboss eval run --suite refund-desk-eval-suite --runs 2 --save-baseline eval/baseline/main-baseline.json

# Run CLI calibration directly
npx agboss eval calibrate --report eval/calibration/calibration-run.json --labels eval/human-labels/refund-desk-eval-suite.jsonl
```
