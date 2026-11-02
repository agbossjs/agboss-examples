# Kubernetes + PostgreSQL scaling — instructions for coding agents

This is an [AGBoss](https://agboss.dev) application (`KubernetesScalingApplication`): workers that
an autoscaler scales on real queued work.

Before writing or changing any AGBoss code, read `.claude/skills/agboss/SKILL.md` — it is the
framework's own guide for the installed `agboss` version and routes each task to one reference:

| Task                                                   | Read                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------- |
| Writing `*.workflow.ts` paths                          | `.claude/skills/agboss/references/02-flow-dsl-all-combinations.md`    |
| Components, DI, lifecycle hooks, `app.execute`         | `.claude/skills/agboss/references/03-components-di-and-lifecycle.md`  |
| Storage, metrics, shutdown, several instances          | `.claude/skills/agboss/references/09-persistence-k8s-and-deploy.md`   |
| Tests: `testWith`, instances, leases, `meterProviders` | `.claude/skills/agboss/references/10-testing-vcr-and-evals.md`        |

The loop after every change: `npx agboss check` → `npm test` → `npm run demo`; after a change to
`deploy/`: `npm run check:k8s` (Docker, the network).

`.claude/skills/agboss/` is managed by `agboss check` and replaced on every `agboss` upgrade —
put this project's own rules below, never there.

## Project rules
- All components must remain stateless (`agboss/no-component-state`).
- `npm run check`, `npm test` and `npm run demo` run 100% offline, $0, no model, no key.
- Metrics come only from the core through the official OpenTelemetry exporter (`src/telemetry.ts`):
  no Prometheus client, no metric of our own, no tenant or execution id as a label.
- A scale rule aggregates `agboss_cluster_*` with `max`, `agboss_instance_*` with `sum`
  (`tests/telemetry/scale-queries.test.ts`).
- The pod's `terminationGracePeriodSeconds` stays above the preStop sleep plus the app's
  `shutdownTimeout`.
