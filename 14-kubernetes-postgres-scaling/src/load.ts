// The workload generator (agbossjs/agboss#487, the `agboss-load` Job): posts batches to the
// coordinator. `LOAD_BATCHES` is `<batchId>:<jobs>:<durationMs>[,…]` — `backlog:80:4000` is a batch
// of 80 jobs that each work 4 s. It only submits; what happened is read from state afterwards.
const coordinator = process.env.COORDINATOR_URL ?? "http://coordinator:8080";
const plan = (process.env.LOAD_BATCHES ?? "backlog:80:4000").split(",");

for (const entry of plan) {
  const [batchId = "", count = "0", durationMs = "0"] = entry.split(":");
  const jobs = Array.from({ length: Number(count) }, (_, index) => ({
    jobId: `${batchId}-${String(index).padStart(3, "0")}`,
    durationMs: Number(durationMs),
  }));
  const response = await fetch(`${coordinator}/api/batches`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ batchId, jobs }),
  });
  if (response.status !== 202) throw new Error(`batch ${batchId}: HTTP ${String(response.status)} ${await response.text()}`);
  console.log(`submitted ${batchId}: ${String(jobs.length)} jobs × ${durationMs} ms`);
}
