# RAG Reranking — instructions for coding agents

This is an [AGBoss](https://agboss.dev) application (`HandbookApplication`).

Before writing or changing any AGBoss code, read `.claude/skills/agboss/SKILL.md` — it is the
framework's own guide for the installed `agboss` version and routes each task to one reference:

| Task                                                        | Read                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| Designing a workflow, its DTOs                              | `.claude/skills/agboss/references/01-composition-and-architecture.md`    |
| Writing `*.workflow.ts` paths, `.onError`                   | `.claude/skills/agboss/references/02-flow-dsl-all-combinations.md`       |
| Components, DI, knowledge bases, `@Reranker`                | `.claude/skills/agboss/references/03-components-di-and-lifecycle.md`     |
| Tests: unit runners, `testWith`, `testRag`                  | `.claude/skills/agboss/references/10-testing-vcr-and-evals.md`           |
| A `[rule.code]` error, a CLI command                        | `.claude/skills/agboss/references/11-cli-studio-and-error-catalog.md`    |

The loop after every change: `npx agboss check` → `npm test` → `npm run demo`.

`.claude/skills/agboss/` is managed by `agboss check` and replaced on every `agboss` upgrade —
put this project's own rules below, never there.

## Project rules
- All components must remain stateless (`agboss/no-component-state`).
- `npm run check`, `npm test` and `npm run demo` run 100% offline, $0: the Cohere SDK is pointed at
  its local stub on `127.0.0.1` (or the stub's in-process `fetch`), models are scripted — never a
  real API, never a key.
- The Cohere wiring (`src/rerankers/cohere.reranker.ts`) starts with the notice and the docs' date;
  the stub cites the docs it follows. The SDK is pinned exactly in `package.json`.
- Swapping the reranker changes only the `by` of `src/rag/handbook.rag.ts`.
