# `support-refund-desk` — Guardrails, PII Roundtrip, Tool Interception, Memory & Evaluation Proofs

## 1. What this example proves

`support-refund-desk` proves that AGBoss enforces deterministic safety boundaries around LLM agents and provides a rigorous, statistically sound evaluation pipeline:

1. **Reversible PII Token Roundtrip & Boundary Refusal (`@PiiPolicy`, `revealPii`):**
   - Customer emails (`PiiKind.Email`) and custom ticket IDs (`support-ticket-id`) are replaced with HMAC-keyed tokens (`<email:d1ac5c>`) before any model call.
   - Tools marked with `revealPii: true` (`IssueRefundTool`) receive the real de-tokenized email for external side effects while all traces, execution records, and eval artifacts remain masked.
   - Raw payment card numbers (`PiiKind.CardNumber`) are refused at the boundary with `PiiRefusedError`.
2. **Pre-Execution Tool Interception & Guardrails (`@ToolInterceptor`, `@InputGuardrail`, `@OutputGuardrail`):**
   - `RefundPolicyToolInterceptor` intercepts over-cap refund attempts (`> $500`) with `ToolCallDecision.replyToModel(...)` so the model revises its decision to `"escalated"` with zero side effects on `OrderBookService`.
   - Cross-tenant order lookups are hard-blocked with `ToolCallDecision.block(...)` (`ToolBlockedError`).
   - `PromptInjectionGuardrail` (`DecidedBy.Code`, $0) blocks prompt injection before any model call; `UnauthorizedPayoutGuardrail` (`DecidedBy.Model`) blocks unverified legal settlement promises on output.
3. **Memory Compaction vs. Policy Drift (`@Compaction`, `@Rag`):**
   - Across a 5-turn conversation (`uncompactedTurns: 2`, `turnsBetweenCompactions: 2`), `PolicyAwareCompaction` summarizes older turns while explicitly marking early v1.0 policy claims (`90 days / $2,000`) as superseded by active v2.0 policy (`30 days / $500`).
4. **5-Layer Evaluation & Judge Calibration (`@EvalSuite`, `agboss eval`):**
   - `pass@k` vs `pass^k` (`isUnstable: true`) and baseline comparison (`CaseComparison.FlakyOnBaseline` quarantined vs `CaseComparison.Regressed`).
   - Judge calibration (`agboss eval calibrate`) computing pairwise Cohen's $\kappa$, confusion matrices, and rubric disagreements against `eval/human-labels/refund-desk-eval-suite.jsonl`.
   - Deterministic chaos (`--chaos 0.4 --chaos-seed 7`) and metamorphic invariance (`--metamorphic`).
   - Incident-to-regression drafting (`agboss generate eval-case --from-execution`) with masked PII and conversation history.
   - Self-contained sanitized HTML reports (`agboss eval show --html`).

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

## 3. Architecture

- `src/support-refund-desk.application.ts` — `SupportRefundDeskApplication` with `SupportOfflineModelProvider`, `CustomerContactPiiPolicy`, `AuditTrailToolInterceptor`, SQLite persistence, and multi-scope budgets.
- `src/dto/` — Narrow DTOs (`1 class = 1 file`).
- `src/pii-policies/` — `CustomerContactPiiPolicy` and `SupportTicketIdPiiPolicy`.
- `src/guardrails/` — `PromptInjectionGuardrail` (`DecidedBy.Code`) and `UnauthorizedPayoutGuardrail` (`DecidedBy.Model`) in component subdirectories.
- `src/interceptors/` — `RefundPolicyToolInterceptor` (`replyToModel` + `block`) and `AuditTrailToolInterceptor`.
- `src/rag/` & `src/compactions/` — `RefundPolicyRag`, `SupportConversationCompaction`, and `PolicyAwareCompaction`.
- `src/agents/` & `src/judges/` — `RefundSupportAgent`, `LiveRefundSupportAgent`, `CitationCodeJudge`, and `GroundedAnswerJudge` in component subdirectories.
- `src/eval-suites/refund-desk.eval-suite.ts` — `RefundDeskEvalSuite` (`EvalCascade.StopAtFirstFailure`).

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

# Run CLI evaluation & calibration directly
npx agboss eval calibrate --report eval/calibration/calibration-run.json --labels eval/human-labels/refund-desk-eval-suite.jsonl
```

## 6. Expected output

- `npm run check` passes with `0 errors, 0 warnings`.
- `npm test` passes all 4 test suites (`pii.test.ts`, `policy.test.ts`, `memory.test.ts`, `eval.test.ts`).
- `npm run demo` outputs the structured verification summary for Scenarios A, B, C, and D.

## 7. Guarantee boundaries

- **Guaranteed by AGBoss:** PII tokenization before model calls and selective tool de-tokenization (`revealPii`), synchronous tool interception before `ToolHandler.execute`, code-first and model-backed guardrail enforcement, cascade eval execution (`trajectory → code judge → model judge`), `pass@k` vs `pass^k` separation, Cohen's $\kappa$ calibration, and trace/record PII masking.
- **Application's responsibility:** Defining domain-accurate regex patterns for custom `@PiiDetector`s, writing non-ambiguous judge rubrics, and enforcing database-level tenant isolation inside external tool backends.

## 8. Related AGBoss concepts

- `@PiiPolicy`, `@PiiDetector`, `PiiAction`, `revealPii`
- `@ToolInterceptor`, `ToolCallDecision.allow()`, `ToolCallDecision.replyToModel()`, `ToolCallDecision.block()`
- `@InputGuardrail`, `@OutputGuardrail`, `GuardrailDecision`
- `@Compaction`, `CompactionStrategy`, `@Rag`, `RagMode`
- `@EvalSuite`, `evalCase`, `checkTrajectory`, `judgedBy`, `EvalCascade`, `CaseComparison`
