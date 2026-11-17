# `03-support-refund-desk` — Guardrails, PII Roundtrip, Tool Interception, In-Memory RAG & Evaluation Proofs

## 1. What this example proves

`03-support-refund-desk` proves that AGBoss enforces deterministic safety boundaries around LLM agents and provides a rigorous, statistically sound evaluation pipeline:

1. **Reversible PII Token Roundtrip & Boundary Refusal (`@PiiPolicy`, `revealPii`):**
   - Customer emails (`PiiKind.Email`) and custom ticket IDs (`support-ticket-id`) are replaced with HMAC-keyed tokens (`<email:…>`: a digest of the value under a key of its own, different from one application key to the next) before any model call.
   - Tools marked with `revealPii: true` (`IssueRefundTool`) receive the real de-tokenized email for external side effects while all traces, execution records, and eval artifacts remain masked.
   - Raw payment card numbers (`PiiKind.CardNumber`) are refused at the boundary with `PiiRefusedError`.
2. **Pre-Execution Tool Interception & Guardrails (`@ToolInterceptor`, `@InputGuardrail`, `@OutputGuardrail`):**
   - `RefundPolicyToolInterceptor` intercepts over-cap refund attempts (`> $500`) with `ToolCallDecision.replyToModel(...)` so the model revises its decision to `"escalated"` with zero side effects on `OrderBookService`.
   - Cross-tenant order lookups are hard-blocked with `ToolCallDecision.block(...)` (`ToolBlockedError`).
   - `PromptInjectionGuardrail` (`DecidedBy.Code`, $0) blocks prompt injection before any model call; `UnauthorizedPayoutGuardrail` (`DecidedBy.Model`) blocks unverified legal settlement promises on output.
3. **In-Memory `@Rag` (`InMemoryKnowledgeIndexService` + `RefundPolicyRetriever`) & Memory Compaction vs. Policy Drift (`@Compaction`):**
   - `InMemoryKnowledgeIndexService` splits `fixtures/refund-policy-current.md` into 6 markdown sections (`[policy-window]`, `[policy-cap]`, `[policy-digital-licenses]`, `[policy-vip-restocking]`, `[policy-tenant]`, `[policy-citation]`) and ranks chunks using deterministic BM25/TF-IDF token overlap + citation boost.
   - `RefundPolicyRetriever` queries the top-K relevant sections and injects `RetrievedChunk[]` into `RefundPolicyRag` (`RagMode.Context`).
   - The knowledge base is per tenant (agbossjs/agboss#700, #796): `@Rag({ tenancy: RagTenancy.PerTenant })`, every retrieval reads `options.tenantId` and searches that tenant's corpus only (the fixtures are `acme`'s; another tenant gets none of them). `tests/rag/refund-policy.rag-contract.test.ts` runs `ragConnectorContract` on it.
   - Across a 5-turn conversation (`uncompactedTurns: 2`, `turnsBetweenCompactions: 2`), `PolicyAwareCompaction` summarizes older turns while explicitly marking early v1.0 policy claims (`90 days / $2,000`) as superseded by active v2.0 policy (`30 days / $500`).
4. **5-Layer Evaluation, Compact Git Baseline & Judge Calibration (`@EvalSuite`, `agboss eval`):**
   - `RefundDeskEvalSuite` (`src/eval-suites/refund-desk.eval-suite.ts`) defines the quality gate executed by `npx agboss eval run` in CI/CD before deployment (`trajectory → code judge → model judge` with `EvalCascade.StopAtFirstFailure`).
   - Compact `eval/baseline/main-baseline.json` (`kind: "agboss.eval-baseline"`, `schemaVersion: 1`) stores only git-diff-friendly metrics (`caseId`, `caseHash`, `runs`, `passed`, `passAtK`, `passHatK`, `flaky`, `avgSpendUsd`, `verdictSummary`), while full per-run traces stay in `.agboss/eval/` (gitignored).
   - `pass@k` vs `pass^k` (`isUnstable: true`) and baseline comparison (`CaseComparison.FlakyOnBaseline` quarantined vs `CaseComparison.Regressed`).
   - Judge calibration (`agboss eval calibrate`) computing pairwise Cohen's $\kappa$, confusion matrices, and rubric disagreements against `eval/human-labels/refund-desk-eval-suite.jsonl`.

5. **A deadline for the answer, an escalation, a reminder, an extension and a pause listener (`@ChannelRole({ expiresIn, remindBefore })`, `.onError(PauseExpiredError, toQuestion(…))`, `app.extendPause`, `@PauseListener`):**
   - A refund above the self-service cap (`refund-approval-workflow`) is put to the on-call support lead (`refund-approver-question`), who has `APPROVAL_EXPIRES_IN` (default `4h`) to answer. When nobody does, the pause closes `expired`, the question step fails with `PauseExpiredError` and the flow's side path asks the head of support (`senior-refund-approver-question`, a pause of its own); an approval there issues the refund once (`OrderBookService`, keyed by the step's idempotency key).
   - The lead's channel hears `onPauseExpiring` once per deadline (`remindBefore` is a quarter of the window) and `onPauseExtended` after `app.extendPause`. The head's channel implements `PauseExpiryHandler`: when even the head does not answer, the desk **declines** on the channel's own answer (`PauseExpiration.decide`, recorded `PauseResolution.DecidedOnExpiry`) — never an approval nobody looked at.
   - `RefundDeskPauseListener` (`@PauseListener`) writes "opened" and "closed: <reason>" for every pause of the application to the on-call log, once per `deliveryId` (notices are at least once). A late answer to the lead's pause is `PauseClosedError` with `reason: expired`.

6. **Files in agents under PII policies (`ModelFiles`, `FileView.Redacted`, `PiiFileAction.RedactWithModel`):**
   - A customer attaches a photo of a receipt (`ReceiptRefundRequestDto.receipt`, an `A2AFileDto`). `ReceiptReaderAgent` reads it only as a redacted copy: the built-in image redactor (a cheap vision model names the regions, `sharp` paints them black) hides the card number and email named by `ReceiptPhotoPiiPolicy` before the photo reaches the agent's model. The desk-wide `CustomerContactPiiPolicy` is excluded for this agent (it blocks a card number, which would conflict with blacking it out).
   - `files: PiiFileAction.RedactWithModel` is the explicit opt-in to let the model decide: an IBAN it finds refuses the photo (`PiiRefusedError`), a malformed answer fails closed (`FileRedactionFailedError`). A model-checked image is a guardrail, not a guarantee.
   - `StrictReceiptReaderAgent` keeps the desk-wide block rule: the image is refused whole (`PiiRefusedError`, `card-number`) before any model, the redactor included, is asked.
   - Needs the optional peer dependency `sharp` (`npm i sharp`); `maxFileSize` stays within the 64 KB an execution keeps without a file store.

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

# Opt-in, real model, skips without OPENROUTER_API_KEY; RECEIPT_OUT_DIR=<dir> saves the images the models were sent
npm run demo:files:live

# Scenario E on the real clock: the lead has 30 s; the escalation, the late answer and the listener's four lines are printed
APPROVAL_EXPIRES_IN=30s npm run demo:approval
```

## 3. Canonical `src/` & symmetric `tests/` layout

- `src/support-refund-desk.application.ts` — `SupportRefundDeskApplication` with `SupportOfflineModelProvider`, `CustomerContactPiiPolicy`, `AuditTrailToolInterceptor`, SQLite persistence, and multi-scope budgets.
- `src/workflows/support-refund/` — `support-refund.workflow.ts`, `support-refund.workflow-start.ts`, `support-refund.workflow-finish.ts`.
- `src/workflows/live-support-refund/` — `live-support-refund.workflow.ts`, `live-support-refund.workflow-start.ts`, `live-support-refund.workflow-finish.ts`.
- `src/contexts/` — `support-tenant.context.ts`, `support-execution.context.ts`.
- `src/dto/` — Narrow edge DTOs (`1 class = 1 file`).
- `src/services/in-memory-knowledge-index.service.ts` & `src/retrievers/refund-policy.retriever.ts` — Real in-memory BM25/TF-IDF section indexer and retriever injected into `src/rag/refund-policy.rag.ts`.
- `src/workflows/refund-approval/`, `src/channels/` (two question roles and their channels), `src/listeners/refund-desk.pause-listener.ts`, `src/actions/settle-refund.action.ts`, `src/config/approval-window.ts` — the approval with a deadline and its escalation (`scenarios/approval-escalation.ts`).
- `src/agents/receipt-reader/`, `src/agents/strict-receipt-reader/`, `src/workflows/receipt-check/`, `src/workflows/strict-receipt-check/`, `src/dto/receipt-refund-request.dto.ts`, `fixtures/receipt-card-statement.png` — the receipt photo under PII policy (`scenarios/receipt-live.ts`).
- `src/pii-policies/`, `src/guardrails/<name>/`, `src/interceptors/`, `src/compactions/<name>/`, `src/agents/<name>/`, `src/judges/<name>/`.
- `src/eval-suites/refund-desk.eval-suite.ts` & `eval/baseline/main-baseline.json` — Quality-gate suite and compact git-tracked baseline snapshot.
- `tests/` — Mirrors `src/` 1-to-1:
  - `tests/guardrails/prompt-injection/prompt-injection.guardrail.test.ts`
  - `tests/interceptors/refund-policy.interceptor.test.ts`
  - `tests/judges/citation-code/citation-code.judge.test.ts`
  - `tests/retrievers/refund-policy.retriever.test.ts`
  - `tests/workflows/support-refund/support-refund.workflow.test.ts` (including end-to-end Langfuse OTel collector span verification)
  - `tests/workflows/receipt-check/receipt-check.workflow.test.ts` and `tests/workflows/strict-receipt-check/strict-receipt-check.workflow.test.ts` (the redacted copy, the refusal, spend under `files:redactor`)
  - `tests/workflows/refund-approval/refund-approval.workflow.test.ts` (the escalation, the reminder, the extension and the default on the test's virtual clock)

## 4. Failure / scenario matrix

| Scenario | Injected Threat / Condition | AGBoss Mechanism | Observable Proof |
|---|---|---|---|
| **A: PII Roundtrip & Refusal** (`scenarios/pii.ts`) | Raw email, ticket ID, and raw payment card number in customer message | `@PiiPolicy`, `PiiAction.replaceWithToken()`, `revealPii: true`, `PiiAction.blockWithRefusal()` | Model sees `<email:d1ac5c>`; `IssueRefundTool` receives `alice.synth@example.com`; card number throws `PiiRefusedError` |
| **B: Policy & Guardrails** (`scenarios/policy.ts`) | Over-cap `$1,450` tool call, cross-tenant lookup, prompt injection, and legal settlement promise | `@ToolInterceptor`, `@InputGuardrail`, `@OutputGuardrail` | Over-cap call gets `ToolCallStatus.Replied` and escalates; cross-tenant throws `ToolBlockedError`; guardrails throw `GuardrailBlockedError` |
| **C: Memory vs. Policy Drift** (`scenarios/memory-drift.ts`) | Customer cites superseded v1.0 90-day policy across 5 turns for 45-day-old `ORD-1003` | `PolicyAwareCompaction` + `RefundPolicyRag` (`RagMode.Context`) | Compaction preserves `ORD-1003` fact, strips stale v1.0 claim, and agent denies refund (`refundedUsd === 0`) |
| **D: 5-Layer Evaluation** (`scenarios/evals.ts`) | Flaky run (`1/2`), rubric ambiguity across human raters, chaos faults, and incident drafting | `agboss eval run --baseline`, `eval calibrate`, `--chaos`, `--metamorphic`, `generate eval-case` | `FlakyOnBaseline` quarantined; `Regressed` caught; $\kappa = 1.00$ (`anna`) / $0.57$ (`ben`); drafted case & HTML report contain zero raw PII |
| **E: Approval Deadline & Escalation** (`scenarios/approval-escalation.ts`) | Nobody answers the on-call lead's approval of a $1,450 refund; later, nobody answers the head either | `expiresIn`, `.onError(PauseExpiredError, toQuestion(…))`, `remindBefore`, `app.extendPause`, `PauseExpiryHandler`, `@PauseListener` | The head is asked, approves, one refund is issued; the lead's late answer is `PauseClosedError` (`expired`); the listener logged opened and closed for both pauses; with no answer at all the desk declines and issues nothing |
| **F: Receipt Photo under PII Policy** (`tests/workflows/receipt-check/receipt-check.workflow.test.ts`, `tests/workflows/strict-receipt-check/strict-receipt-check.workflow.test.ts`) | Card number, email and an IBAN on a photo of a receipt; a redaction model that answers prose instead of regions | `ModelFiles.of({ views: [FileView.Redacted] })`, `PiiFileAction.RedactWithModel`, block rule refusing an image whole, `mockLlm(FileRedactor)` | The reader's model gets one image part whose `sha256` differs from the original and no raw email; spend under `files:redactor`; an IBAN found throws `PiiRefusedError`, a prose answer `step.file-redaction-failed`, and under the desk's block rule the image is refused (`card-number`) with no model call |

## 5. How to reproduce each case

```bash
# Run all automated Vitest proofs
npm test

# Run CLI evaluation & save compact baseline
npx agboss eval run --suite refund-desk-eval-suite --runs 2 --save-baseline eval/baseline/main-baseline.json

# Run CLI calibration directly
npx agboss eval calibrate --report eval/calibration/calibration-run.json --labels eval/human-labels/refund-desk-eval-suite.jsonl
```
