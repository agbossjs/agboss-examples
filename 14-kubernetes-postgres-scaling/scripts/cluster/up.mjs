// `npm run cluster:up` (agbossjs/agboss#487): one command from a machine with Docker, kind and
// kubectl to a running blueprint — the kind node capped at 3 CPU / 4 GB, the image built and
// loaded, PostgreSQL migrated, the stub, Prometheus, KEDA, the coordinator and one worker Ready.
import { execFileSync } from "node:child_process";
import { CLUSTER, CONTEXT, NODE, NODE_CPUS, NODE_MEMORY, NAMESPACE, PROJECT, has, kubectl, log, output, run, until } from "./kube.mjs";
import { buildImage } from "./build-image.mjs";

const KEDA = "https://github.com/kedacore/keda/releases/download/v2.20.2/keda-2.20.2.yaml";

for (const binary of ["docker", "kind", "kubectl"])
  if (!has(binary)) throw new Error(`${binary} is not on the PATH: the blueprint needs Docker, kind (≥ 0.31) and kubectl (≥ 1.33)`);

const clusters = output("kind", ["get", "clusters"]).split("\n");
if (clusters.includes(CLUSTER)) log(`kind cluster ${CLUSTER} exists: reusing it`);
else {
  log(`creating kind cluster ${CLUSTER}`);
  run("kind", ["create", "cluster", "--config", "deploy/kind/cluster.yaml", "--wait", "180s"]);
}
log(`capping the node container: docker update --cpus ${NODE_CPUS} --memory ${NODE_MEMORY} ${NODE}`);
run("docker", ["update", "--cpus", NODE_CPUS, "--memory", NODE_MEMORY, "--memory-swap", NODE_MEMORY, NODE]);

buildImage();

const apply = (file) => run("kubectl", ["--context", CONTEXT, "apply", "-f", file]);
log("PostgreSQL, the secrets, the ledger stub");
apply("deploy/kind/infra.yaml");
run("kubectl", ["--context", CONTEXT, "-n", NAMESPACE, "rollout", "status", "deploy/postgres", "--timeout=180s"]);
run("kubectl", ["--context", CONTEXT, "-n", NAMESPACE, "rollout", "status", "deploy/ledger-stub", "--timeout=120s"]);

log("migrating the schema (agboss-postgres migrate, a Job)");
run("kubectl", ["--context", CONTEXT, "-n", NAMESPACE, "delete", "job", "agboss-migrate", "--ignore-not-found"]);
apply("deploy/kind/migrate-job.yaml");
run("kubectl", ["--context", CONTEXT, "-n", NAMESPACE, "wait", "--for=condition=complete", "job/agboss-migrate", "--timeout=180s"]);

log("Prometheus");
apply("deploy/kind/monitoring/prometheus.yaml");
log(`KEDA 2.20.2 (${KEDA})`);
run("kubectl", ["--context", CONTEXT, "apply", "--server-side", "--force-conflicts", "-f", KEDA]);
for (const deployment of ["keda-operator", "keda-metrics-apiserver", "keda-admission"])
  run("kubectl", ["--context", CONTEXT, "-n", "keda", "rollout", "status", `deploy/${deployment}`, "--timeout=240s"]);
run("kubectl", ["--context", CONTEXT, "-n", "monitoring", "rollout", "status", "deploy/prometheus-server", "--timeout=180s"]);

log("the coordinator, the workers, the ScaledObject");
const rendered = output("kubectl", ["kustomize", "--load-restrictor", "LoadRestrictionsNone", "deploy/kind/apps"]);
// the webhook of a freshly started KEDA may refuse for a few seconds
await until("the apps applied", () => {
  execFileSync("kubectl", ["--context", CONTEXT, "apply", "-f", "-"], { cwd: PROJECT, input: rendered, stdio: ["pipe", "inherit", "inherit"] });
  return true;
}, { timeoutMs: 120_000, everyMs: 5_000 });
run("kubectl", ["--context", CONTEXT, "-n", NAMESPACE, "rollout", "status", "deploy/coordinator", "--timeout=180s"]);
run("kubectl", ["--context", CONTEXT, "-n", NAMESPACE, "rollout", "status", "deploy/agboss-worker", "--timeout=180s"]);
await until("the ScaledObject Ready", () =>
  kubectl(["get", "scaledobject", "agboss-worker", "-o", "jsonpath={.status.conditions[?(@.type=='Ready')].status}"]).trim() === "True",
);
log("up: every workload Ready — next: npm run cluster:scenario");
log(output("docker", ["stats", "--no-stream", "--format", "node {{.Name}}: CPU {{.CPUPerc}}, memory {{.MemUsage}}", NODE]).trim());
