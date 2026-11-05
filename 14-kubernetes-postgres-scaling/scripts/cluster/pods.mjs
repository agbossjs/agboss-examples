// agbossjs/agboss#781: whether the workers are settled at `count` — that many worker pods, none of
// them being deleted. The Deployment's status counts `count` while a pod it removed is still in its
// preStop and grace period, and that pod still claims work: a step that freezes "a worker" must not
// pick one the ReplicaSet is about to delete.
export const WORKER_POD_PREFIX = "agboss-worker-";

/** `pods`: `{ name, deleting }` of the blueprint's pods. */
export function workersSettledAt(pods, count) {
  const workers = pods.filter((pod) => pod.name.startsWith(WORKER_POD_PREFIX));
  return workers.length === count && workers.every((pod) => !pod.deleting);
}
