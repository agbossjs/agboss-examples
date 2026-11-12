# `15-mongo-redis` — MongoDB + Redis: Durable Records on a Replica Set, Coordination on Redis

> **Priority:** P1 — the most error-prone store setup: leases on one backend and the durable rows on
> another, the ids the leases hand out kept with the durable rows, and nothing that needs a lease
> check in one transaction (fenced effects, outbound calls) on the wrong backend
> **Principle:** Promise → Wiring the assembly checks → Reproducible Proof

`MongoRedisApplication` splits its stores between two servers:

- **Redis** coordinates (`@agboss/redis`, `REDIS_COORDINATION_STORES`): the execution leases, the
  queue of children launched on any instance, the rate limits.
- **MongoDB** keeps everything durable (`@agboss/mongodb`, `MONGODB_DURABLE_STORES`): records,
  checkpoints, pauses, execution trees, history, budgets, mesh requests, the audit log, A2A tasks.

```ts
providers: [
  ...MONGODB_DURABLE_STORES,
  ...REDIS_COORDINATION_STORES,
  provide(EXECUTION_ID_STORE, MongoExecutionLeaseRepository),
],
```

The Redis lease store keeps no execution ids of its own (an id handed out is kept forever, with the
durable rows): it injects `EXECUTION_ID_STORE`, and `provide(EXECUTION_ID_STORE, MongoExecutionLeaseRepository)`
has the container create MongoDB's lease store under that token only — no `new`, and no second lease
store (listing the class itself is `[di.ambiguous-implementation]`).

**Coordination only.** A fenced effect or an outbound call checks the lease in the same transaction
as its write, which a Redis lease and a MongoDB row cannot share. So this application lists neither,
and the core refuses one at assembly (`[application.store-backend-mismatch]`) — the recount's steps
have no effect outside the execution, so running one again after a crash is safe. Work that must
happen exactly once (a charge, a message) belongs on MongoDB leases: list `MONGODB_STORES` instead.

The guarantees and what they assume: [Guarantees](https://github.com/agbossjs/agboss/wiki/Guarantees),
[Several instances](https://github.com/agbossjs/agboss/wiki/Several-instances).

## 1. Engineering Promises Tested

| Promise | AGBoss mechanism | Proof |
| --- | --- | --- |
| **Two backends, one wiring, no `new`** | the store bundles and `provide(EXECUTION_ID_STORE, Class)` | `npm run check` (`agboss check --strict` assembles `MongoRedisApplication`); [`tests/stores/store-wiring.test.ts`](./tests/stores/store-wiring.test.ts) › "AC3" |
| **No second lease store** | the class under the token only | `tests/stores/store-wiring.test.ts` › "AC2: MongoDB's lease store listed as a class …" (`[di.ambiguous-implementation]`) |
| **No double-charge protection promised that Redis cannot give** | the one-backend rule at assembly | `tests/stores/store-wiring.test.ts` › "AC2: a fenced-effect store …", "… outbound-call store …" (`[application.store-backend-mismatch]`), before anything connects |
| **Children on any instance, each counted once** | `ChildPlacement.AnyInstance` on the Redis child queue, the trees on Redis leases, the state on MongoDB | [`tests/workflows/recount.workflow.test.ts`](./tests/workflows/recount.workflow.test.ts) (offline twin, two instances); [`tests/live/recount.live.test.ts`](./tests/live/recount.live.test.ts) (the real application, two instances, `MONGODB_URL` + `REDIS_URL`) |
| **The schema is versioned and migrated explicitly** | `agboss-mongodb migrate` / `migrateMongodb`, `SchemaSetup.Check` at start | `npm run demo:live` migrates first; the start refuses an unmigrated or newer schema |

## 2. Run it

```bash
npm run check   # agboss check --strict on both applications, tsc, eslint — offline
npm test        # the twin on two instances, the wiring; the live test is skipped without the URLs
npm run demo    # offline: twelve shelves on two instances of the twin
```

Against real servers (a replica set — a standalone `mongod` is refused — and a Redis with
`appendfsync always` and `noeviction`):

```bash
export MONGODB_URL=…  REDIS_URL=…       # in your environment, never on a command line
npm run migrate                         # agboss-mongodb migrate: the schema, versioned
npm run demo:live                       # twelve shelves on two instances of MongoRedisApplication
npx vitest run tests/live               # the same as a test
```

`MONGODB_SCHEMA_SETUP=migrate-on-start` makes each start migrate first instead; the default
(`check`) refuses an unmigrated or newer schema, so pods need no rights to change it.

**One Redis key prefix per MongoDB database** (`REDIS_KEY_PREFIX`, `redisKeyPrefix`; the live test
sets its own with its database). A lease key is never deleted, and a retired lease is never taken
again; the execution ids come from MongoDB (`EXECUTION_ID_STORE`) and start again with a new
database — an id handed out as new whose lease key already exists in Redis fails with
`RedisLeaseKeyConflictError` instead of waiting for a take that cannot succeed.

## 3. Layout

- `src/mongo-redis.application.ts` — the stores and the workflows; `src/environments/` its settings
  (`mongodbUrl`, `redisUrl` as `Secret`s, `mongodbDatabase`, `mongodbSchemaSetup`).
- `src/workflows/recount/` — one `shelf-workflow` per shelf, on any instance; `src/workflows/shelf/`
  — one code step (`count-shelf-action`).
- `src/local/` — the same workflows on the core's SQLite stores, for the offline tests and demo.
