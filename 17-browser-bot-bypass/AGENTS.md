# Browser — bot bypass (stealth) — instructions for coding agents

This is an [AGBoss](https://agboss.dev) application (`BrowserBotBypassApplication`).

Before writing or changing any AGBoss code, read `.agents/skills/agboss/SKILL.md` — it is the
framework's own guide for the installed `agboss` version and routes each task to one reference:

| Task                                                        | Read                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| Designing a workflow, its DTOs                              | `.agents/skills/agboss/references/01-composition-and-architecture.md`    |
| Writing `*.workflow.ts` paths, `.onError`                   | `.agents/skills/agboss/references/02-flow-dsl-all-combinations.md`       |
| Components, DI, lifecycle hooks (`onDestroy`)               | `.agents/skills/agboss/references/03-components-di-and-lifecycle.md`     |
| `@McpServer`, `@McpTool`                                    | `.agents/skills/agboss/references/04-mcp-and-a2a.md`                     |
| PII policies and files                                      | `.agents/skills/agboss/references/07-guardrails-pii-and-security.md`     |
| Tests: unit runners, `testWith`, two instances              | `.agents/skills/agboss/references/10-testing-vcr-and-evals.md`           |
| A `[rule.code]` error, a CLI command                        | `.agents/skills/agboss/references/11-cli-studio-and-error-catalog.md`    |

The loop after every change: `npx agboss check` → `npm test` → `npm run demo`.

`.agents/skills/agboss/` is managed by `agboss check` and replaced on every `agboss` upgrade —
put this project's own rules below, never there.

## Project rules
- All components must remain stateless (`agboss/no-component-state`). The shared browser is a resource
  in a plain class (`src/browser/browser-handle.ts`) that `StealthBrowser`'s hooks own.
- `npm run check`, `npm test` and `npm run demo` run offline, $0, with no Chrome, no display and no key:
  the `BrowserFactory` role is the fake of `src/fake/` (`BROWSER_FACTORY=fake`, set by vitest and the demo).
  Never start a real Chrome in a test.
- `src/vendor/stealth-browser.ts` is vendored MIT code: keep its header, `NOTICE` and
  `src/vendor/LICENSE.playwright-bot-bypass`; list changes in the header.
- The allowlist (`src/browser/origin-allowlist.ts`) guards both ways; the browser has its own network,
  outside AGBoss's A2A SSRF guard. Never list 127.0.0.1.
- `rebrowser-playwright`, `@modelcontextprotocol/sdk` and `zod` are pinned exactly.
