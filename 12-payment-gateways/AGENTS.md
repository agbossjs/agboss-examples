# Payment Gateways — instructions for coding agents

This is an [AGBoss](https://agboss.dev) application (`PaymentGatewaysApplication`).

Before writing or changing any AGBoss code, read `.claude/skills/agboss/SKILL.md` — it is the
framework's own guide for the installed `agboss` version and routes each task to one reference:

| Task                                                        | Read                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| Designing a workflow, its DTOs                              | `.claude/skills/agboss/references/01-composition-and-architecture.md`    |
| Writing `*.workflow.ts` paths, `.onError`                   | `.claude/skills/agboss/references/02-flow-dsl-all-combinations.md`       |
| Components, DI, lifecycle hooks, `app.execute`              | `.claude/skills/agboss/references/03-components-di-and-lifecycle.md`     |
| Approvals, pauses, channels, `app.resume`                   | `.claude/skills/agboss/references/05-channels-and-human-in-the-loop.md`  |
| Storage, recovery, shutdown, several instances              | `.claude/skills/agboss/references/09-persistence-k8s-and-deploy.md`      |
| Tests: unit runners, `testWith`, instances, leases           | `.claude/skills/agboss/references/10-testing-vcr-and-evals.md`           |
| A `[rule.code]` error, a CLI command                        | `.claude/skills/agboss/references/11-cli-studio-and-error-catalog.md`    |

The loop after every change: `npx agboss check` → `npm test` → `npm run demo`.

`.claude/skills/agboss/` is managed by `agboss check` and replaced on every `agboss` upgrade —
put this project's own rules below, never there.

## Project rules
- All components must remain stateless (`agboss/no-component-state`).
- `npm run check`, `npm test` and `npm run demo` run 100% offline, $0: every SDK is pointed at its
  local stub on `127.0.0.1` — never a real gateway, never a sandbox, never a key.
- Every number a test or the demo asserts is read from the stub's own records (`stub.moneyFor()`).
- One folder per supported gateway, `src/gateways/<slug>/`: `<slug>.gateway-payments.ts` (the
  wiring, at most 70 code lines, starting with the notice and the docs' date), `stub/` (each
  behaviour citing its docs URL, the read date and the quote; `UNVERIFIED` where the docs are
  silent), `README.md` (the notice). An unsupported gateway has no folder, only its README row.
- SDKs are pinned exactly in `package.json`; the transport that points an SDK at its stub lives
  beside the wiring (`*-stub-transport.ts`), never in it.
- A known core boundary is asserted as such, with its ticket — never shown as passing.
