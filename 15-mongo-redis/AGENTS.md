# MongoDB + Redis — instructions for coding agents

This is an [AGBoss](https://agboss.dev) application (`MongoRedisApplication`): Redis coordinates —
the leases, the child queue, the rate limits (`@agboss/redis`, `REDIS_COORDINATION_STORES`) — and a
MongoDB replica set keeps everything durable (`@agboss/mongodb`, `MONGODB_DURABLE_STORES`), wired
with `provide(EXECUTION_ID_STORE, MongoExecutionLeaseRepository)` and no `new` (agbossjs/agboss#891).
`LocalMongoRedisApplication` (`src/local/`) is the same workflows on SQLite, for the offline tests
and the demo.

Before writing or changing any AGBoss code, read `.claude/skills/agboss/SKILL.md` — it is the
framework's own guide for the installed `agboss` version and routes each task to one reference:

| Task                                                                   | Read                                                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Writing `*.workflow.ts` paths                                          | `.claude/skills/agboss/references/02-flow-dsl-all-combinations.md`   |
| Components, DI, lifecycle hooks, `app.execute`                         | `.claude/skills/agboss/references/03-components-di-and-lifecycle.md` |
| Storage, several instances                                             | `.claude/skills/agboss/references/09-persistence-k8s-and-deploy.md`  |
| Tests: `testWith`, instances                                           | `.claude/skills/agboss/references/10-testing-vcr-and-evals.md`       |

The loop after every change: `npx agboss check` → `npm test` → `npm run demo`; against real servers:
`npm run demo:live` with `MONGODB_URL` and `REDIS_URL` set (`.env.example`).

`.claude/skills/agboss/` is managed by `agboss check` and replaced on every `agboss` upgrade —
put this project's own rules below, never there.

## Project rules

- All components must remain stateless (`agboss/no-component-state`).
- `npm run check`, `npm test` and `npm run demo` run 100% offline, $0, no model, no key.
- The stores come from the bundles only — never a store class constructed by hand, never MongoDB's
  lease store listed as a class beside Redis's (`[di.ambiguous-implementation]`).
- No fenced-effect or outbound-call store beside Redis leases (`[application.store-backend-mismatch]`):
  a step here has no effect outside the execution; work that must happen once runs on MongoDB leases.
- Never a connection string on a command line: `agboss-mongodb migrate` reads `MONGODB_URL`.
