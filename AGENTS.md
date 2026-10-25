# AGENTS.md — Coding Agent Instructions for `agboss-examples`

This repository contains standalone executable proofs for **AGBoss** (`agboss` and `agboss-cli`).

## Key Rules for AI Coding Agents

1. **Central Principle (`Promise → Failure Injection → Reproducible Proof`):**
   Every example must test both the positive path and the controlled failure injection path, asserting observable outcomes (diagnostic codes, compensation records, ledger states, masked PII tokens, eval metrics) rather than console log strings.
2. **Independent Projects (R1 & R2):**
   - Each example directory (`01-hello-agboss`, `02-path-scope-proof`, `03-support-refund-desk`, `04-travel-booking-saga`, `05-cluster-work-stealing`, `06-enterprise-agent-mesh`, `07-langgraph-migration-smoke`) is a self-contained project.
   - Never import from `../agboss/src` or private internals. Use only public `agboss` exports.
   - Each generated/authored AGBoss project syncs its own coding-agent skills via `agboss check` (`.claude/skills/agboss/SKILL.md` and modules `01`–`13`).
3. **Offline-First Verification (R4 & R5):**
   - `npm run check`, `npm test`, and `npm run demo` must run 100% offline without `OPENROUTER_API_KEY`.
   - Negative fixtures (e.g. `02-path-scope-proof/cases/*/agboss-broken`) are tested through `tests/diagnostics.test.ts` so the suite asserts the expected compiler errors while exiting `0`.
4. **No Secrets (R6):**
   - Never create or commit `.env` files with real keys. Only commit `.env.example` with blank or synthetic placeholders.
