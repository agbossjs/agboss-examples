# `langgraph-migration-smoke` — Coding-Agent LangGraph Migration & Skill Verification Proof

## 1. What this example proves

`langgraph-migration-smoke` proves that AI coding agents (Claude Code, Cursor, Gemini CLI, Codex) can migrate a conventional LangGraph application to AGBoss using the 13 coding-agent skills shipped inside the `agboss` npm package (`node_modules/agboss/skills/agboss/`), specifically `references/13-migrating-from-langgraph.md`:

1. **Skill Packaging & Sync Verification:** Confirms that `SKILL.md` and all 13 reference guides (`01` through `13-migrating-from-langgraph.md`) are present in the packed tarball and synced by `agboss skills sync`.
2. **15-Field God State Decomposition:** Replaces `LegacySupportState` (15 mutable fields in `source/legacy-langgraph/support.graph.ts`) with 10 narrow producer DTOs (`src/dto/*.dto.ts`).
3. **Elimination of Latent LangGraph Shared-State Bugs:**
   - Splits `write` into `ReplyWriterAgent` and `ReplyEditorAgent` so no node reads `draft` or `critique` when `undefined` (`[input.missing-on-path]`).
   - Annotates the review cycle with `caseOf(ChangesRequestedDto, { about: ReplyDraftDto })` and `historyOf(ReplyDraftDto, { limit: 2 })` (`[input.outdated-on-path]`, `[io.ambiguous-cycle]`).
   - Replaces unbounded `Send("research")` + manual reducer concatenation with `.toParallelAgents(OrderResearcherAgent, { maxConcurrency: 3, maxItems: 5 }).join().returns(listOf(ResearchFindingDto))`.
   - Replaces `interrupt()` with `RefundSignOffChannel` (`@ChannelRole`) and `IssueSignedOffRefundTool` (`@Tool({ channel: RefundSignOffChannel })`).

## 2. Quick start

```bash
npm run check
npm test
npm run demo
```

To evaluate an external coding agent CLI (`claude`, `codex`, `gemini`):

```bash
MIGRATION_AGENT_CMD="claude -p prompts/migrate.md" npm test
```

## 3. Architecture

- `source/legacy-langgraph/support.graph.ts` — Legacy 15-field `SupportState` LangGraph implementation and latent-bug trace inspector.
- `prompts/migrate.md` — Vendor-neutral coding-agent migration prompt.
- `src/` — Migrated AGBoss DTOs (`src/dto/`), services (`src/services/`), channels (`src/channels/`), tools (`src/tools/`), agents (`src/agents/`), routers (`src/routers/`), actions (`src/actions/`), workflow (`src/workflows/support.workflow.ts`), and `src/langgraph-migration-smoke.application.ts`.
- `harness/` — Clean project verification (`create-clean-project.ts`), agent runner (`run-coding-agent.ts`), static & AST validator (`validate-output.ts`), and benchmark scorecard (`measure-results.ts`).
- `expected/acceptance-tests/` — Held-out acceptance test inputs and assertions.

## 4. Failure / scenario matrix

| Legacy Anti-Pattern | Latent Failure in `source/legacy-langgraph/` | AGBoss Static / Runtime Proof |
|---|---|---|
| 15-field God State (`LegacySupportState`) | `write` interpolates `Draft: undefined` and `fixing: undefined` on visit 1 | Narrow DTOs + separate `ReplyWriterAgent` / `ReplyEditorAgent` verified by `[input.missing-on-path]` |
| Cyclic review loop (`write ↔ review`) | Stale critique or infinite loop without provenance | `caseOf(ChangesRequestedDto, { about: ReplyDraftDto })`, `historyOf(ReplyDraftDto, { limit: 2 })`, `maxVisits: 2` + `.onError(VisitsLimitExceededError, ...)` |
| Unbounded `Send("research")` fan-out | Unbounded concurrency & manual array reducer | `.toParallelAgents(OrderResearcherAgent, { maxConcurrency: 3, maxItems: 5 }).join()` |
| Untyped `interrupt()` in `signOff` | Unvalidated resume payload | `@ChannelRole({ approves: RefundOrderDto })` + `app.resume({ pauseId, decision })` |

## 5. How to reproduce each case

```bash
npm test
```

## 6. Expected output

- `npm run check` passes with `0 errors, 0 warnings`.
- `npm test` passes all 5 acceptance and harness tests in `tests/migration-harness.test.ts`.
- `npm run demo` outputs the structured migration scorecard (`skillsPackagedCount: 13`, `legacyStateFieldsCount: 15`, `narrowDtosCount: 10`, `agbossCheckPassed: true`).

## 7. Guarantee boundaries

- **Guaranteed by AGBoss:** Packaging of all 13 coding-agent skill guides in `agboss`, compile-time Path & Scope verification (`agboss check`), bounded parallel fan-out, typed channel pauses, and $0 scripted testing (`testWith`).
- **Application's responsibility:** Domain service implementations (`OrderBookService`, `RefundApiService`) and business rules (e.g., the `10_000`-cent supervisor sign-off threshold).

## 8. Related AGBoss concepts

- `agboss skills sync`, `.agents/skills/agboss/references/13-migrating-from-langgraph.md`
- `historyOf`, `about`, `oneOf`, `caseOf`, `listOf`
- `VisitsLimitExceededError`, `maxVisits`, `maxSteps`
- `testWith`, `mockLlm`, `testRouter`, `toFollowPath`, `toHavePausedAt`, `toFinishWith`
