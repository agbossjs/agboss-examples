# Safe Payments — instructions for coding agents

This is an [AGBoss](https://agboss.dev) application (`SafePaymentsApplication`).

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
- `npm run check`, `npm test`, `npm run demo` and `npm run check:yours` run 100% offline, $0,
  against the stub gateway on `127.0.0.1` — never a real gateway, never a key.
- Every number a test or the demo asserts is read from the stub's own records (`stub.ledger()`,
  `stub.moneyFor()`), never from the application's view or a console line.
- Every money-moving call goes through `PaymentOperations`. A wrong version is one class in
  `src/payments/wrong/` overriding `RightPaymentOperations`; it never touches AGBoss's stores.
- Every scenario row has a right-version expectation, and, unless it is the gateway's side, a
  wrong one; `tests/bites.test.ts` runs each right assertion on the wrong version and expects it
  to fail. A known core boundary is asserted as such, with its ticket — never shown as passing.
- The scenarios' seams (gates, a failing store) live in `scenarios/` and are overrides of the test;
  the application never calls them.
- The stub gateway is fictional: it imitates no real gateway's API or name. Every README that names
  a gateway carries the "independent example, not affiliated" notice.
