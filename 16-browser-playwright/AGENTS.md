# Browser — Playwright — instructions for coding agents

This is an [AGBoss](https://agboss.dev) application (`BrowserPlaywrightApplication`).

Before writing or changing any AGBoss code, read `.agents/skills/agboss/SKILL.md` — it is the
framework's own guide for the installed `agboss` version and routes each task to one reference:

| Task                                                        | Read                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| Designing a workflow, its DTOs                              | `.agents/skills/agboss/references/01-composition-and-architecture.md`    |
| Writing `*.workflow.ts` paths, `.onError`                   | `.agents/skills/agboss/references/02-flow-dsl-all-combinations.md`       |
| Components, DI, lifecycle hooks (`onDestroy`)               | `.agents/skills/agboss/references/03-components-di-and-lifecycle.md`     |
| `@McpServer`, `@McpTool`                                    | `.agents/skills/agboss/references/04-mcp-and-a2a.md`                     |
| Fenced effects, outbound calls                              | `.agents/skills/agboss/references/06-finops-providers-and-queues.md`     |
| PII policies and files                                      | `.agents/skills/agboss/references/07-guardrails-pii-and-security.md`     |
| Tests: unit runners, `testWith`, two instances              | `.agents/skills/agboss/references/10-testing-vcr-and-evals.md`           |
| A `[rule.code]` error, a CLI command                        | `.agents/skills/agboss/references/11-cli-studio-and-error-catalog.md`    |

The loop after every change: `npx agboss check` → `npm test` → `npm run demo`.

`.agents/skills/agboss/` is managed by `agboss check` and replaced on every `agboss` upgrade —
put this project's own rules below, never there.

## Project rules
- All components must remain stateless (`agboss/no-component-state`). The shared browser is a
  resource in a plain class (`src/browser/browser-handle.ts`) that `SharedBrowser`'s hooks own; no
  execution's data lives in it, each call has a context of its own.
- `npm run check`, `npm test` and `npm run demo` run offline, $0, with no model and no key: a headless
  Chromium against the local site `src/site/contact-site.ts` on `127.0.0.1`, the models scripted.
  Never a real site, never a real key. `npm run browsers` installs the Chromium (CI does it too).
- The allowlist (`src/browser/origin-allowlist.ts`) is the context's route: exact origin on every request,
  redirects followed by hand; the browser's resolver rules are defence in depth only. Change neither
  without `tests/allowlist.test.ts`, `tests/route-only.test.ts`, `tests/refusals.test.ts`,
  `tests/redirects.test.ts` and `tests/mcp-launcher.test.ts` — they are the proof. Never list 127.0.0.1.
- The form's submit goes through `ContactDesk.once`: an outbound call keyed by the request's reference.
  Never a bare click in a tool or an action — `tests/submit-once.test.ts` is red on one.
- `playwright`, `@playwright/mcp` and `@modelcontextprotocol/sdk` are pinned exactly; `playwright` is the
  version `@playwright/mcp` pins itself, so one copy is installed.
