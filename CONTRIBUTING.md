# Contributing to `agboss-examples`

Thanks for contributing to the AGBoss executable architecture & reliability proofs repository.

## Workflow & Issues

1. Every change starts as a GitHub Issue in [`agbossjs/agboss-examples`](https://github.com/agbossjs/agboss-examples/issues) (or references a parent Epic / ticket via `Refs #<issue>`).
2. Labels follow the AGBoss conveyor:
   - Types: `type:epic` · `type:feature` · `type:bugfix` · `type:chore`
   - Priorities: `prio:mvp` (P0 pre-release) · `prio:stretch` (P1 advanced) · `blocked`
   - Stages: `status:triage` → `status:backlog` → `status:in-progress` → `status:test` → `status:done`
3. Branch naming: `feat/<issue>-<slug>`, `fix/<issue>-<slug>`, `chore/<issue>-<slug>`, `docs/<issue>-<slug>`.
4. Commit messages follow Conventional Commits with the issue number: `feat(#5): ...`, `chore(#2): ...`.

## Repository Rules (R1–R6)

When adding or updating an example:

- **R1 (Standalone):** The example must have its own `package.json`, `tsconfig.json`, `.env.example`, `README.md` (with all 10 required sections), `npm run check`, `npm test`, and `npm run demo`.
- **R2 (No internal imports):** Never import from the `agboss` source monorepo or `agboss/internal`. Depend only on public package entry points (`agboss`, `agboss/dto`, `agboss/testing`, `agboss/units`, `agboss/models`, `agboss/eval`, `agboss/mcp`, `agboss/rag`, `agboss/a2a`, `agboss/eslint`).
- **R3 (Minimal tooling):** Keep `scripts/tooling/` limited to process runners, isolated directory helpers, diagnostic/event assertions, and report generation.
- **R4 (Offline-first):** `npm run check`, `npm test`, and `npm run demo` must pass deterministically with zero network calls and no API keys.
- **R5 (Green CI):** Negative fixtures (intentionally broken flows) must be isolated under fixture subdirectories and asserted by tests so top-level `npm test` and `npm run check` exit `0`.
- **R6 (Zero secrets):** Never commit `.env` files, real API keys, or unredacted customer/personal data.

## Before Opening a Pull Request

```bash
npm run typecheck
npm run check
npm test
```
