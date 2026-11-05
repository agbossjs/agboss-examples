// `npm run cluster:scenario` (agbossjs/agboss#487): the whole cycle on the running kind cluster —
// backlog → scale-out → distributed execution → a worker killed mid-run → recovery → the dead and
// risen worker (frozen, killed before its write, killed after it) → scale-in — and the verification.
//
// Every claim comes from state: the Deployment's replicas and the pods (Kubernetes), the slot demand
// (Prometheus), the stub's record of what reached the other system, and the coordinator's
// verification over the kept execution records, the lease log and the outbound calls. Nothing is
// parsed from an application's console. The run is written to .artifacts/kubernetes-run.json; the
// exit code is 0 only when every check passed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  API,
  NODE,
  PROJECT,
  PROMETHEUS,
  STUB,
  http,
  kubectl,
  kubectlJson,
  log,
  output,
  until,
} from "./kube.mjs";
import { workersSettledAt } from "./pods.mjs";

/** agbossjs/agboss#777: the least average share of the cluster's slots at work while the backlog exceeds them. */
const CLUSTER_FILL = 0.85;

const started = Date.now();
/** This run's prefix: batch and job ids are unique per run, so the scenario runs again on the same cluster. */
const RUN = `r${started.toString(36)}`;
const id = (name) => `${RUN}-${name}`;
const at = () => Math.round((Date.now() - started) / 1000);
const checks = [];
const check = (name, passed, detail) => {
  checks.push({ name, passed: Boolean(passed), detail });
  log(`${passed ? "PASS" : "FAIL"} ${name} — ${detail}`);
};

// ---------- what we read ----------

const SLOT_DEMAND =
  "max(agboss_cluster_children_queued) + sum(agboss_instance_steps_waiting) + sum(agboss_instance_step_slots_busy)";

async function promValue(query) {
  const { body } = await http(
    `${PROMETHEUS}/api/v1/query?query=${encodeURIComponent(query)}`,
  );
  const value = body?.data?.result?.[0]?.value?.[1];
  return value === undefined ? undefined : Number(value);
}

/** A query's series by pod: `{ <pod>: value }`. */
async function promByPod(query) {
  const { body } = await http(
    `${PROMETHEUS}/api/v1/query?query=${encodeURIComponent(query)}`,
  );
  return Object.fromEntries(
    (body?.data?.result ?? []).map((series) => [
      series.metric.pod,
      Number(series.value[1]),
    ]),
  );
}

const workers = () => {
  const deployment = kubectlJson(["get", "deploy", "agboss-worker"]);
  return {
    replicas: deployment.status.replicas ?? 0,
    ready: deployment.status.readyReplicas ?? 0,
    desired: deployment.spec.replicas,
  };
};
const appPods = () =>
  kubectlJson([
    "get",
    "pods",
    "-l",
    "app.kubernetes.io/part-of=agboss-scaling",
  ]).items.map((pod) => ({
    name: pod.metadata.name,
    phase: pod.status.phase,
    deleting: pod.metadata.deletionTimestamp !== undefined,
    restarts: pod.status.containerStatuses?.[0]?.restartCount ?? 0,
    lastExitCode:
      pod.status.containerStatuses?.[0]?.lastState?.terminated?.exitCode,
  }));
const stubState = async () => (await http(`${STUB}/control/state`)).body;
const stubControl = (path, body) =>
  http(`${STUB}/control/${path}`, { method: "POST", body });
/** Any ready pod answers the API (`agboss-api`); a frozen one is out of the endpoints, but retried. */
async function api(path, body) {
  return until(
    `the API ${path}`,
    async () => {
      const response = await http(
        `${API}${path}`,
        body === undefined ? {} : { method: "POST", body, timeoutMs: 15_000 },
      );
      return response.status < 500 ? response : undefined;
    },
    { timeoutMs: 60_000, everyMs: 1_000 },
  );
}
const batchRecord = async (batchId) => {
  const { status, body } = await api(
    `/api/batches/${encodeURIComponent(batchId)}`,
  );
  return status === 200 ? body : undefined;
};
const treeOf = async (rootExecutionId) =>
  (await api(`/api/trees/${rootExecutionId}`)).body;
const submit = async (batchId, jobs) => {
  const { status } = await api("/api/batches", { batchId, jobs });
  if (status !== 202)
    throw new Error(`batch ${batchId}: HTTP ${String(status)}`);
  log(`submitted ${batchId}: ${String(jobs.length)} jobs`);
};
const jobsOf = (batchId, count, durationMs) =>
  Array.from({ length: count }, (_, index) => ({
    jobId: `${batchId}-${String(index).padStart(3, "0")}`,
    durationMs,
  }));
/** A pod's view of itself, as an operator reads it: its `agboss_*` metrics and the framework's warnings in its log. */
const podViewOf = (pod) => {
  const view = { pod: pod.name, restarts: pod.restarts };
  try {
    view.metrics = kubectl([
      "exec",
      pod.name,
      "--",
      "sh",
      "-c",
      "wget -qO- http://127.0.0.1:9464/metrics | grep '^agboss_'",
    ])
      .trim()
      .split("\n");
  } catch (error) {
    view.metrics = `unread: ${error instanceof Error ? error.message : String(error)}`;
  }
  try {
    view.warnings = kubectl(["logs", pod.name, "--tail", "400"])
      .split("\n")
      .filter((line) => /warn|error/iu.test(line))
      .slice(-40);
  } catch (error) {
    view.warnings = `unread: ${error instanceof Error ? error.message : String(error)}`;
  }
  return view;
};
/** What a batch that does not finish left, from public evidence only: its record, its trees' lease log and calls, the pods. */
async function stuckEvidenceOf(batchId) {
  const calls = await stubState().catch(() => ({
    work: [],
    ledgerRequests: [],
  }));
  const roots = [
    ...new Set(
      [...calls.work, ...calls.ledgerRequests]
        .filter((call) => String(call.jobId).startsWith(batchId))
        .map((call) => call.rootExecutionId),
    ),
  ];
  const trees = {};
  for (const root of roots)
    trees[root] = await treeOf(root).catch((error) => ({
      error: String(error),
    }));
  const record = await api(`/api/batches/${encodeURIComponent(batchId)}`)
    .then((response) => response.body)
    .catch((error) => ({ error: String(error) }));
  return {
    batchId,
    record,
    trees,
    pods: appPods()
      .filter((pod) => !pod.deleting)
      .map(podViewOf),
  };
}
/** The batch's record once it ended: finished, else (failed or cancelled) an error at once — never a timeout for an ended batch. */
const finished = async (batchId, timeoutMs = 360_000) => {
  let ended;
  try {
    ended = await until(
      `batch ${batchId} finished`,
      async () => {
        const record = await batchRecord(batchId);
        // ended: finished, failed or cancelled (a paused or running batch is waited for)
        return ["finished", "failed", "cancelled"].includes(record?.status)
          ? record
          : undefined;
      },
      { timeoutMs, everyMs: 3_000 },
    );
  } catch (error) {
    events.stuck = await stuckEvidenceOf(batchId);
    throw error;
  }
  if (ended.status !== "finished") {
    events.stuck = await stuckEvidenceOf(batchId);
    throw new Error(
      `batch ${batchId} failed: ${JSON.stringify(ended.error ?? {}).slice(0, 400)}`,
    );
  }
  return ended;
};
/** The work call of a job, once it reached the stub. */
const workCallOf = (jobId, timeoutMs = 90_000) =>
  until(
    `the work call of ${jobId}`,
    async () => (await stubState()).work.find((call) => call.jobId === jobId),
    { timeoutMs, everyMs: 1_000 },
  );
const signal = (pod, name) =>
  kubectl(["exec", pod, "--", "sh", "-c", `kill -${name} $(pidof node)`]);

// ---------- the timeline, sampled while everything runs ----------

const timeline = [];
let sampling = true;
const sampler = (async () => {
  while (sampling) {
    try {
      const { replicas, ready, desired } = workers();
      const demand = await promValue(SLOT_DEMAND);
      const queued = await promValue("max(agboss_cluster_children_queued)");
      // the pods' slots at work and their limits (agbossjs/agboss#767: full while work is queued)
      const busy = await promValue("sum(agboss_instance_step_slots_busy)");
      const slots = await promValue("sum(agboss_instance_step_slots_limit)");
      const podBusy = await promByPod("agboss_instance_step_slots_busy");
      const podSlots = await promByPod("agboss_instance_step_slots_limit");
      timeline.push({ t: at(), replicas, ready, desired, demand, queued, busy, slots, podBusy, podSlots });
    } catch {
      // a sample missed is a sample missed: the next one comes in 2 s
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
})();
const nodeStats = [];
const sampleNode = (phase) => {
  const line = output("docker", [
    "stats",
    "--no-stream",
    "--format",
    "{{.CPUPerc}}|{{.MemUsage}}",
    NODE,
  ]).trim();
  const [cpu, memory] = line.split("|");
  nodeStats.push({ t: at(), phase, cpu, memory });
  log(`node ${NODE}: CPU ${cpu} (of 300 %), memory ${memory}`);
};

const batches = [];
const expectations = [];
const events = {};

try {
  // ---------- 0. a quiet cluster: one worker (autoscaling on, even after a run that stopped midway) ----------
  try {
    kubectl([
      "annotate",
      "scaledobject",
      "agboss-worker",
      "autoscaling.keda.sh/paused-replicas-",
    ]);
  } catch {
    // not paused: nothing to remove
  }
  await until(
    "one worker, no demand",
    async () => {
      const now = workers();
      return (
        now.replicas === 1 &&
        now.ready === 1 &&
        (await promValue(SLOT_DEMAND)) === 0
      );
    },
    { timeoutMs: 420_000, everyMs: 5_000 },
  );
  const baseline = workers();
  check(
    "baseline",
    baseline.ready === 1,
    `${String(baseline.ready)} worker ready, slot demand 0`,
  );
  sampleNode("idle");

  // ---------- 1. backlog → scale-out (AC1, AC2) ----------
  const backlog = jobsOf(id("backlog"), 80, 4_000);
  batches.push({
    batchId: id("backlog"),
    jobIds: backlog.map((job) => job.jobId),
  });
  kubectl(["delete", "job", "agboss-load", "--ignore-not-found"]);
  const load = readFileSync(
    join(PROJECT, "deploy/kind/load-job.yaml"),
    "utf8",
  ).replace('value: "backlog:80:4000"', `value: "${id("backlog")}:80:4000"`);
  output("kubectl", ["--context", "kind-agboss-scaling", "apply", "-f", "-"], {
    input: load,
    stdio: ["pipe", "pipe", "pipe"],
  });
  events.backlogSubmitted = at();
  await until(
    "the load Job complete",
    () =>
      kubectl([
        "get",
        "job",
        "agboss-load",
        "-o",
        "jsonpath={.status.succeeded}",
      ]).trim() === "1",
    { timeoutMs: 120_000 },
  );
  check(
    "AC1 workload started",
    true,
    "the agboss-load Job posted the backlog: 80 jobs × 4 s",
  );

  // ---------- 2. a worker killed mid-run (AC3), while the workers scale out ----------
  const victim = await until(
    "a worker pod with a job in flight",
    async () => {
      if (workers().ready < 2) return undefined;
      const state = await stubState();
      return state.work.find(
        (call) =>
          call.answeredAt === undefined &&
          call.pod.startsWith("agboss-worker-"),
      );
    },
    { timeoutMs: 180_000, everyMs: 1_000 },
  );
  // a crash, not a stop: SIGKILL of node in the container (exit 137), then the pod deleted at once
  // so that its Deployment replaces it with a new pod
  log(
    `killing ${victim.pod} mid-run (job ${victim.jobId}, instance ${victim.instanceId}): kill -9, then the pod deleted`,
  );
  try {
    signal(victim.pod, "9");
  } catch {
    // the exec's own process dies with the container: an error here is the kill working
  }
  kubectl([
    "delete",
    "pod",
    victim.pod,
    "--grace-period=0",
    "--force",
    "--wait=false",
  ]);
  events.killed = {
    at: at(),
    pod: victim.pod,
    instanceId: victim.instanceId,
    jobId: victim.jobId,
  };

  const scaledOut = await until(
    "4 workers ready",
    () => {
      const now = workers();
      return now.ready >= 4 ? now : undefined;
    },
    { timeoutMs: 300_000 },
  );
  events.scaledOut = at();
  sampleNode("backlog, 4 workers");
  check(
    "AC2 scale-out",
    scaledOut.ready === 4,
    `${String(baseline.ready)} → ${String(scaledOut.ready)} workers ${String(events.scaledOut - events.backlogSubmitted)} s after the backlog was submitted`,
  );

  await finished(id("backlog"));
  events.backlogDone = at();
  // agbossjs/agboss#767: while more children wait than the pods have slots, a pod that claims keeps
  // all its slots at work — it claims up to its free slots, a child at work counted once (before:
  // twice, so a pod of 4 slots refilled only after two of its jobs ended). Per pod, from Prometheus
  // (every 5 s); a pod that has not looked at the queue yet (it looks at once when a child is queued
  // in its own process, else at its sweep, every 30 s) is counted in the cluster's fill only.
  const loaded = timeline.filter(
    (sample) =>
      sample.t >= events.backlogSubmitted &&
      sample.t <= events.backlogDone &&
      sample.slots > 0 &&
      sample.queued >= sample.slots,
  );
  const claiming = loaded.flatMap((sample) =>
    Object.entries(sample.podBusy ?? {})
      .filter(([pod, busy]) => busy > 0 && (sample.podSlots?.[pod] ?? 0) > 0)
      .map(([pod, busy]) => busy / sample.podSlots[pod]),
  );
  const podFill = claiming.reduce((sum, one) => sum + Math.min(1, one), 0) / Math.max(1, claiming.length);
  const clusterFill =
    loaded.reduce((sum, sample) => sum + Math.min(1, sample.busy / sample.slots), 0) /
    Math.max(1, loaded.length);
  events.slotFill = { samples: loaded.length, podSamples: claiming.length, podFill, clusterFill };
  check(
    "#767 slots full under the backlog",
    claiming.length > 0 && podFill >= 0.9,
    `${String(claiming.length)} pod samples with ≥ the pods' slots queued: a claiming pod's slots ${(podFill * 100).toFixed(0)} % at work on average`,
  );
  // agbossjs/agboss#777: every pod is woken by the queue's NOTIFY the moment another process queues a
  // child — a freshly scaled-out pod, or one whose last look found the queue empty, no longer idles
  // until its sweep (30 s): the cluster's slots, every pod counted, stay full while the backlog lasts
  check(
    "#777 the cluster's slots full under the backlog",
    loaded.length > 0 && clusterFill >= CLUSTER_FILL,
    `${String(loaded.length)} samples with ≥ the pods' slots queued: the cluster's slots ${(clusterFill * 100).toFixed(0)} % at work on average (at least ${String(CLUSTER_FILL * 100)} %)`,
  );
  const replaced = appPods().filter(
    (pod) => pod.name.startsWith("agboss-worker-") && !pod.deleting,
  );
  check(
    "AC3 the killed worker replaced",
    !replaced.some((pod) => pod.name === victim.pod) && replaced.length >= 1,
    `${victim.pod} gone; workers now ${replaced.map((pod) => pod.name).join(", ")}`,
  );
  const victimTree = await treeOf(victim.rootExecutionId);
  const takenOver = victimTree.leaseEvents.filter(
    (event) =>
      event.kind === "takeover" &&
      event.previousHolderInstanceId === victim.instanceId,
  );
  check(
    "AC3 its jobs recovered",
    takenOver.length >= 1,
    `${String(takenOver.length)} lease(s) of ${victim.pod} taken over by other pods (lease log)`,
  );
  events.recovered = takenOver.map((event) => ({
    executionId: event.executionId,
    by: event.holderInstanceId,
    token: event.token,
    at: event.occurredAt,
  }));

  // ---------- 3. the dead and risen worker (AC5), autoscaling paused at 3 ----------
  kubectl([
    "annotate",
    "scaledobject",
    "agboss-worker",
    "autoscaling.keda.sh/paused-replicas=3",
    "--overwrite",
  ]);
  // agbossjs/agboss#781: and no worker pod still terminating — the one removed for 4 → 3 claims
  // work during its preStop, and a frozen pod the ReplicaSet deletes never comes back ready
  await until(
    "3 workers ready (autoscaling paused), none terminating",
    () => workers().ready === 3 && workers().replicas === 3 && workersSettledAt(appPods(), 3),
    { timeoutMs: 180_000 },
  );

  // 3.1 frozen mid-step, its lease taken over, resumed: its write refused
  const zombieJob = { jobId: id("zombie-z"), durationMs: 1_000 };
  await stubControl("holds", {
    jobId: zombieJob.jobId,
    stage: "work",
    times: 1,
  });
  batches.push({ batchId: id("zombie"), jobIds: [zombieJob.jobId] });
  await submit(id("zombie"), [zombieJob]);
  const frozen = await workCallOf(zombieJob.jobId);
  log(
    `freezing ${frozen.pod} (SIGSTOP) while its job ${frozen.jobId} waits for its remote work`,
  );
  const restartsBefore =
    appPods().find((pod) => pod.name === frozen.pod)?.restarts ?? 0;
  signal(frozen.pod, "STOP");
  events.frozen = {
    at: at(),
    pod: frozen.pod,
    instanceId: frozen.instanceId,
    token: frozen.token,
  };
  await stubControl("release", { jobId: zombieJob.jobId, stage: "work" });
  const newHolder = await until(
    "another pod took the zombie's job over and delivered it",
    async () => {
      const tree = await treeOf(frozen.rootExecutionId);
      const takeover = tree.leaseEvents.find(
        (event) =>
          event.kind === "takeover" &&
          event.executionId === frozen.executionId &&
          event.previousHolderInstanceId === frozen.instanceId,
      );
      const ran = tree.leaseEvents.find(
        (event) =>
          event.kind === "fenced-effect" &&
          event.executionId === frozen.executionId &&
          event.outcome === "ran",
      );
      return takeover && ran ? { takeover, ran } : undefined;
    },
    { timeoutMs: 80_000, everyMs: 2_000 },
  );
  events.frozen.takenOverAfter = at() - events.frozen.at;
  log(
    `taken over at token ${String(newHolder.takeover.token)} after ${String(events.frozen.takenOverAfter)} s; resuming ${frozen.pod} (SIGCONT)`,
  );
  signal(frozen.pod, "CONT");
  // Back, the zombie cannot write: either it reaches its delivery at its stale token and the store
  // refuses it (the fenced effect), or its own fence — its lease's end on its own clock — stops it
  // first and it writes nothing. Which one comes first after a freeze is a race on its event loop; a
  // write accepted at its token is the only failure.
  await finished(id("zombie"));
  const zombieEvents = async () =>
    (await treeOf(frozen.rootExecutionId)).leaseEvents.filter(
      (event) =>
        event.kind === "fenced-effect" &&
        event.executionId === frozen.executionId &&
        event.holderInstanceId === frozen.instanceId,
    );
  const refusal = await until(
    "the zombie's write refused",
    async () =>
      (await zombieEvents()).find((event) => event.outcome === "refused"),
    {
      timeoutMs: 20_000,
    },
  ).catch(() => undefined);
  const zombieWrites = (await zombieEvents()).filter(
    (event) => event.outcome !== "refused",
  );
  if (refusal !== undefined) {
    check(
      "AC5 zombie cannot write",
      refusal.observedToken > refusal.token && zombieWrites.length === 0,
      `${frozen.pod}'s write at token ${String(refusal.token)} refused: the store saw ${String(refusal.observedToken)}`,
    );
  } else {
    check(
      "AC5 zombie cannot write",
      zombieWrites.length === 0,
      zombieWrites.length === 0
        ? `${frozen.pod} stopped at its own lease's end before its write (no write at token ${String(frozen.token)}); the store's refusal is the backstop for the window its fence does not see`
        : `${frozen.pod} wrote at its stale token: ${JSON.stringify(zombieWrites)}`,
    );
  }
  events.frozen.outcome =
    refusal === undefined ? "stopped-by-own-fence" : "refused";
  expectations.push({
    batchId: id("zombie"),
    jobId: zombieJob.jobId,
    kind: refusal === undefined ? "never-attempted" : "refused",
    instanceId: frozen.instanceId,
    why:
      refusal === undefined
        ? "frozen mid-step, stopped by its own fence after a takeover"
        : "frozen mid-step, resumed after a takeover",
  });
  await until(
    `${frozen.pod} ready again`,
    () => {
      const pod = kubectlJson(["get", "pod", frozen.pod]);
      return (
        pod.status.conditions?.find((condition) => condition.type === "Ready")
          ?.status === "True"
      );
    },
    { timeoutMs: 90_000 },
  );
  const frozenPod = appPods().find((pod) => pod.name === frozen.pod);
  // what the kubelet saw of the frozen pod: each probe failure and kill, with its count and times
  events.frozen.kubelet = kubectlJson([
    "get",
    "events",
    "--field-selector",
    `involvedObject.name=${frozen.pod}`,
  ])
    .items.filter(
      (event) => event.type === "Warning" || event.reason === "Killing",
    )
    .map((event) => ({
      reason: event.reason,
      message: event.message,
      count: event.count,
      first: event.firstTimestamp,
      last: event.lastTimestamp,
    }));
  const restarted = (frozenPod?.restarts ?? 0) - restartsBefore;
  check(
    "AC5 the zombie was not restarted",
    restarted === 0,
    restarted === 0
      ? `${frozen.pod}: no restart during the freeze (the liveness window outlasted it)`
      : `${frozen.pod}: ${String(restarted)} restart(s); the kubelet: ${JSON.stringify(events.frozen.kubelet)}`,
  );
  // as a member again: a follow-up batch that reaches every pod — it outlasts a sweep (30 s), the
  // moment a pod that hosts no root of the batch first looks at the queue: 48 × 12 s on 12 slots
  const after = jobsOf(id("after"), 48, 12_000);
  batches.push({ batchId: id("after"), jobIds: after.map((job) => job.jobId) });
  await submit(id("after"), after);
  await finished(id("after"));
  expectations.push({
    batchId: id("after"),
    kind: "accepted-by",
    instanceId: frozen.instanceId,
    why: "the resumed pod takes new work as a normal member",
  });

  // 3.1b a job the other system rejects (agbossjs/agboss#763): it ends at its own failure finish,
  // the other jobs go on, and the batch finishes with its counts — it is never cancelled
  const mixed = jobsOf(id("mixed"), 6, 1_000);
  const rejectedJob = mixed[2].jobId;
  await stubControl("rejects", { jobId: rejectedJob });
  batches.push({
    batchId: id("mixed"),
    jobIds: mixed.map((job) => job.jobId),
    failedJobIds: [rejectedJob],
  });
  await submit(id("mixed"), mixed);
  const mixedRecord = await finished(id("mixed"));
  check(
    "#763 a failed job fails alone",
    mixedRecord.output?.succeeded === 5 && mixedRecord.output?.failed === 1,
    `${rejectedJob} rejected by the other system: the batch finished, ${String(mixedRecord.output?.succeeded)} succeeded, ${String(mixedRecord.output?.failed)} failed`,
  );

  // 3.2 killed (exit 137) before it reaches its write: never attempted
  const killedJob = { jobId: id("killed-k"), durationMs: 1_000 };
  await stubControl("holds", {
    jobId: killedJob.jobId,
    stage: "work",
    times: 1,
  });
  batches.push({ batchId: id("killed"), jobIds: [killedJob.jobId] });
  await submit(id("killed"), [killedJob]);
  const killed = await workCallOf(killedJob.jobId);
  log(
    `kill -9 of node in ${killed.pod} before its write (job ${killed.jobId})`,
  );
  try {
    signal(killed.pod, "9");
  } catch {
    // the exec's own process dies with the container: an error here is the kill working
  }
  await stubControl("release", { jobId: killedJob.jobId, stage: "work" });
  const exited = await until(
    `${killed.pod} restarted with exit code 137`,
    () => {
      const pod = appPods().find((one) => one.name === killed.pod);
      return pod?.lastExitCode === 137 ? pod : undefined;
    },
    { timeoutMs: 60_000 },
  );
  events.killedBeforeWrite = {
    at: at(),
    pod: killed.pod,
    instanceId: killed.instanceId,
    exitCode: exited.lastExitCode,
    restarts: exited.restarts,
  };
  check(
    "AC5 killed with exit 137",
    exited.lastExitCode === 137,
    `${killed.pod}: last state terminated, exit code 137, restarted ${String(exited.restarts)}×`,
  );
  await finished(id("killed"));
  expectations.push({
    batchId: id("killed"),
    jobId: killedJob.jobId,
    kind: "never-attempted",
    instanceId: killed.instanceId,
    why: "killed (exit 137) before its write",
  });

  // 3.3 crash after the effect committed, before the checkpoint: replayed, nothing applied twice
  const replayJob = { jobId: id("replay-r"), durationMs: 1_000 };
  await stubControl("holds", {
    jobId: replayJob.jobId,
    stage: "ledger",
    times: 1,
  });
  batches.push({ batchId: id("replay"), jobIds: [replayJob.jobId] });
  await submit(id("replay"), [replayJob]);
  const ledgerCall = await until(
    "the ledger call of the replay job (its delivery committed)",
    async () =>
      (await stubState()).ledgerRequests.find(
        (request) => request.jobId === replayJob.jobId,
      ),
    { timeoutMs: 90_000, everyMs: 1_000 },
  );
  log(
    `kill -9 of node in ${ledgerCall.pod} after its delivery and the ledger entry, before the step's checkpoint`,
  );
  try {
    signal(ledgerCall.pod, "9");
  } catch {
    // as above
  }
  await stubControl("release", { jobId: replayJob.jobId, stage: "ledger" });
  await finished(id("replay"));
  expectations.push({
    batchId: id("replay"),
    jobId: replayJob.jobId,
    kind: "replayed",
    why: "crashed after the effect committed, before the checkpoint",
  });
  const replayState = await stubState();
  check(
    "AC5 the replayed effect applied once",
    replayState.entries.filter((entry) => entry.jobId === replayJob.jobId)
      .length === 1,
    `${String(replayState.entries.filter((entry) => entry.jobId === replayJob.jobId).length)} ledger entry, ${String(replayState.ledgerRequests.filter((request) => request.jobId === replayJob.jobId).length)} request(s) received`,
  );

  // ---------- 4. scale-in (AC2) ----------
  kubectl([
    "annotate",
    "scaledobject",
    "agboss-worker",
    "autoscaling.keda.sh/paused-replicas-",
  ]);
  events.resumedAutoscaling = at();
  await until(
    "back to 1 worker",
    () => workers().replicas === 1 && workers().ready === 1,
    { timeoutMs: 420_000, everyMs: 3_000 },
  );
  events.scaledIn = at();
  check(
    "AC2 scale-in",
    true,
    `3 → 1 workers ${String(events.scaledIn - events.resumedAutoscaling)} s after the demand fell to 0 (stabilization 30 s, one pod per 15 s)`,
  );
  sampleNode("after scale-in");

  // ---------- 5. the verification, from state (AC3, AC5) ----------
  const { body: report } = await api("/api/verification", {
    batches,
    expectations,
  });
  events.report = report;
  check(
    "AC3 + AC5 verification",
    report.passed,
    `${String(report.totals.jobs)} jobs: ${String(report.totals.accepted)} accepted, ${String(report.totals.replayed)} replayed, ${String(report.totals.refused)} refused, ${String(report.totals["never-attempted"])} never attempted, ${String(report.totals.inconsistent)} inconsistent, ${String(report.totals.duplicates)} duplicates; expectations ${report.expectations.filter((one) => one.found).length}/${report.expectations.length}`,
  );
  for (const expectation of report.expectations)
    check(
      `expected: ${expectation.kind} (${expectation.why})`,
      expectation.found,
      `${expectation.batchId}${expectation.jobId ? `/${expectation.jobId}` : ""}`,
    );
  for (const job of report.jobs.filter((one) => one.problems.length > 0))
    check(`job ${job.jobId}`, false, job.problems.join("; "));
} catch (error) {
  check(
    "scenario",
    false,
    error instanceof Error ? error.message : String(error),
  );
} finally {
  sampling = false;
  await sampler;
}

const maxReplicas = Math.max(0, ...timeline.map((sample) => sample.replicas));
const passed = checks.every((one) => one.passed);
mkdirSync(join(PROJECT, ".artifacts"), { recursive: true });
const artifact = {
  passed,
  at: new Date().toISOString(),
  durationSeconds: at(),
  checks,
  events,
  timeline,
  nodeStats,
  maxReplicas,
};
writeFileSync(
  join(PROJECT, ".artifacts", "kubernetes-run.json"),
  `${JSON.stringify(artifact, null, 2)}\n`,
);
console.log("\n=== the run, from state ===");
console.table(
  checks.map(({ name, passed: ok, detail }) => ({
    check: name,
    result: ok ? "PASS" : "FAIL",
    detail: detail.slice(0, 110),
  })),
);
console.log(
  `replicas over time (t s → workers): ${timeline
    .filter(
      (_, index, all) =>
        index === 0 || all[index - 1].replicas !== all[index].replicas,
    )
    .map((sample) => `${String(sample.t)}→${String(sample.replicas)}`)
    .join("  ")}`,
);
console.log(
  `${passed ? "PASSED" : "FAILED"} in ${String(at())} s — .artifacts/kubernetes-run.json`,
);
process.exitCode = passed ? 0 : 1;
