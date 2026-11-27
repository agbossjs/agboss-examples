# MongoDB + Redis — instructions for coding agents

This is an [AGBoss](https://agboss.dev) application (`MongoRedisApplication`): Redis coordinates —
the leases, the child queue, the rate limits (`RecountClusterStorage`, `RedisDriver` of
`@agboss/redis`) — and a MongoDB replica set keeps everything durable (`RecountDatabaseStorage`,
`MongoDriver` of `@agboss/mongodb`), wired by `storage: { database, cluster }` and no `new`
(agbossjs/agboss#891). `LocalMongoRedisApplication` (`src/local/`) is the same workflows on SQLite,
for the offline tests and the demo.

Before writing or changing any AGBoss code, read `.agents/skills/agboss/SKILL.md` — it is the
framework's own guide for the installed `agboss` version and routes each task to one reference:

| Task                                                                   | Read                                                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Writing `*.workflow.ts` paths                                          | `.agents/skills/agboss/references/02-flow-dsl-all-combinations.md`   |
| Components, DI, lifecycle hooks, `app.execute`                         | `.agents/skills/agboss/references/03-components-di-and-lifecycle.md` |
| Storage, several instances                                             | `.agents/skills/agboss/references/09-persistence-k8s-and-deploy.md`  |
| Tests: `testWith`, instances                                           | `.agents/skills/agboss/references/10-testing-vcr-and-evals.md`       |

The loop after every change: `npx agboss check` → `npm test` → `npm run demo`; against real servers:
`npm run demo:live` with `MONGODB_URL` and `REDIS_URL` set (`.env.example`).

`.agents/skills/agboss/` is managed by `agboss check` and replaced on every `agboss` upgrade —
put this project's own rules below, never there.

## Project rules

- All components must remain stateless (`agboss/no-component-state`).
- `npm run check`, `npm test` and `npm run demo` run 100% offline, $0, no model, no key.
- The stores come from the storage components' drivers only — never a store class constructed by
  hand or listed in `providers` beside the storages (`[storage.providers-conflict]`).
- Work that must happen exactly once (a charge, a message) belongs on MongoDB leases: a
  `@DatabaseStorage` without a `@ClusterStorage`.
- Never a connection string on a command line: `agboss-mongodb migrate` reads `MONGODB_URL`.
