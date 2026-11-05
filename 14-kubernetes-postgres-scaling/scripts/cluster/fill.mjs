// agbossjs/agboss#767, #777, #785: how full the pods' slots were while the backlog was larger than
// them, from the scenario's timeline (a sample every 2 s of Prometheus, which scrapes every 5 s).
//
// - A pod's claimed slots are its children claimed or at work: the larger of its steps at work and
//   the leases it holds (`agboss_instance_leases_held`), at most its slots. A claimed child between
//   two steps holds no step slot, so on a starved runner a full pod can read 2 of 4 busy; it holds
//   4 leases all the same (#785).
// - A pod that is gone — killed by the scenario, from that moment — is left out: Prometheus keeps
//   its last series for a while, a dead pod "busy 1 of 4" (#785).

/** `samples`: the timeline; `gone`: `[{ pod, from }]`, a pod left out from `from` (seconds) on. */
export function slotFillOf(samples, { from, to, gone = [] }) {
  const isGone = (pod, t) => gone.some((one) => one.pod === pod && t >= one.from);
  const window = samples.filter((sample) => sample.t >= from && sample.t <= to);
  const podsOf = (sample) =>
    Object.entries(sample.podSlots ?? {})
      .filter(([pod, slots]) => slots > 0 && !isGone(pod, sample.t))
      .map(([pod, slots]) => {
        const busy = sample.podBusy?.[pod] ?? 0;
        const claimed = Math.min(slots, Math.max(busy, sample.podHeld?.[pod] ?? 0));
        return { pod, slots, busy, claimed };
      });
  const loaded = window
    .map((sample) => ({ sample, pods: podsOf(sample) }))
    .filter(({ sample, pods }) => {
      const slots = pods.reduce((sum, one) => sum + one.slots, 0);
      return slots > 0 && sample.queued >= slots;
    });
  const claiming = loaded.flatMap(({ pods }) => pods.filter((one) => one.claimed > 0));
  const podFill =
    claiming.reduce((sum, one) => sum + one.claimed / one.slots, 0) / Math.max(1, claiming.length);
  const clusterFill =
    loaded.reduce((sum, { pods }) => {
      const slots = pods.reduce((total, one) => total + one.slots, 0);
      return sum + pods.reduce((total, one) => total + one.busy, 0) / slots;
    }, 0) / Math.max(1, loaded.length);
  return { samples: loaded.length, podSamples: claiming.length, podFill, clusterFill, ...idleOf(window, podsOf) };
}

/** Per pod, the longest run with nothing claimed while at least its slots were queued. */
function idleOf(window, podsOf) {
  const since = new Map();
  const longestIdle = {};
  for (const sample of window)
    for (const { pod, slots, claimed } of podsOf(sample)) {
      if (claimed > 0 || sample.queued < slots) {
        since.delete(pod);
        continue;
      }
      if (!since.has(pod)) since.set(pod, sample.t);
      longestIdle[pod] = Math.max(longestIdle[pod] ?? 0, sample.t - since.get(pod));
    }
  const [idlest, idleFor] = Object.entries(longestIdle).sort((left, right) => right[1] - left[1])[0] ?? ["none", 0];
  return { longestIdle, idlest, idleFor };
}
