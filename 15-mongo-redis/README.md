# `15-mongo-redis` — MongoDB + Redis: Durable Records on a Replica Set, Coordination on Redis

> **Priority:** P1 — the most error-prone store setup: leases on one backend and the durable rows on
> another, the ids the leases hand out kept with the durable rows, and nothing that needs a lease
> check in one transaction (fenced effects, outbound calls) on the wrong backend
> **Principle:** Promise → Wiring the assembly checks → Reproducible Proof

`MongoRedisApplication` splits its stores between two servers, one storage component each:

- **Redis** coordinates (`RecountClusterStorage`, `RedisDriver` of `@agboss/redis`): the execution
  leases, the queue of children launched on any instance, the rate limits.
- **MongoDB** keeps everything durable (`RecountDatabaseStorage`, `MongoDriver` of `@agboss/mongodb`):
  records, checkpoints, pauses, execution trees, history, budgets, mesh requests, the audit log, A2A tasks.

```ts
storage: { database: RecountDatabaseStorage, cluster: RecountClusterStorage },
```

The drivers are the only source of the connections' settings (`secret("MONGODB_URL")`,
`secret("REDIS_URL")`, `env("MONGODB_DATABASE")`, `env("REDIS_KEY_PREFIX")`), read once when a pod
starts. The Redis lease store keeps no execution ids of its own (an id handed out is kept forever, with
the durable rows): the container binds the database driver's lease store under `EXECUTION_ID_STORE`
for it — no `new`, and no second lease store. A store class listed in `providers` beside the storages
is `[storage.providers-conflict]`: the storage components provide the stores, the drivers choose them.

**Coordination only.** The cluster's stores are the leases, the queue and the rate limits; every other
store, the fenced-effect and outbound-call ones too, is MongoDB's and checks the lease row it keeps
(the database's lease row is the authority for the token, the marks and the fence). The recount's steps
have no effect outside the execution, so running one again after a crash is safe.

The guarantees and what they assume: [Guarantees](https://github.com/agbossjs/agboss/wiki/Guarantees),
[Several instances](https://github.com/agbossjs/agboss/wiki/Several-instances).

## 1. Engineering Promises Tested

| Promise | AGBoss mechanism | Proof |
| --- | --- | --- |
| **Two backends, one wiring, no `new`** | `storage: { database, cluster }` — the drivers and the lease store the container binds under `EXECUTION_ID_STORE` | `npm run check` (`agboss check --strict` assembles `MongoRedisApplication`); [`tests/stores/store-wiring.test.ts`](./tests/stores/store-wiring.test.ts) › "AC1", "AC3" |
| **No second lease store** | the storages provide the stores | `tests/stores/store-wiring.test.ts` › "AC2: MongoDB's lease store listed beside the storages …" (`[storage.providers-conflict]`) |
| **No store chosen outside the drivers** | the storages are the only source of stores | `tests/stores/store-wiring.test.ts` › "AC2: a fenced-effect store …", "… an outbound-call store …" (`[storage.providers-conflict]`), before anything connects |
| **Children on any instance, each counted once** | `ChildPlacement.AnyWorker` on the Redis child queue, the trees on Redis leases, the state on MongoDB | [`tests/workflows/recount.workflow.test.ts`](./tests/workflows/recount.workflow.test.ts) (offline twin, two instances); [`tests/live/recount.live.test.ts`](./tests/live/recount.live.test.ts) (the real application, two instances, `MONGODB_URL` + `REDIS_URL`) |
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

The driver's `schemaSetup` (default `SchemaSetup.Check`) refuses an unmigrated or newer schema, so
pods need no rights to change it; `SchemaSetup.MigrateOnStart` in `RecountDatabaseStorage` makes each
start migrate first instead.

**One Redis key prefix per MongoDB database** (`REDIS_KEY_PREFIX`, `redisKeyPrefix`; the live test
sets its own with its database). A lease key is never deleted, and a retired lease is never taken
again; the execution ids come from MongoDB (`EXECUTION_ID_STORE`) and start again with a new
database — an id handed out as new whose lease key already exists in Redis fails with
`RedisLeaseKeyConflictError` instead of waiting for a take that cannot succeed.

## 3. Layout

- `src/mongo-redis.application.ts` — the storages and the workflows; `src/storages/` — the MongoDB
  database storage and the Redis cluster storage, whose drivers read the settings (`MONGODB_URL`,
  `REDIS_URL` as secrets; `MONGODB_DATABASE`, `REDIS_KEY_PREFIX`; `PII_PSEUDONYM_KEY`).
- `src/workflows/recount/` — one `shelf-workflow` per shelf, on any instance; `src/workflows/shelf/`
  — one code step (`count-shelf-action`).
- `src/local/` — the same workflows on the core's SQLite stores, for the offline tests and demo.
