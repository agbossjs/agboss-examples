// agbossjs/agboss#781 AC1: the zombie step freezes only a pod the ReplicaSet keeps — the workers are
// settled at a count only when that many worker pods exist and none is being deleted.
import { describe, expect, it } from "vitest";
import { workersSettledAt } from "../../scripts/cluster/pods.mjs";

const pod = (name: string, deleting = false) => ({ name, deleting });

describe("#781: workers settled at a count", () => {
  it("three worker pods, none deleting: settled at 3 (other pods do not count)", () => {
    const pods = [pod("agboss-worker-a"), pod("agboss-worker-b"), pod("agboss-worker-c"), pod("coordinator-x")];
    expect(workersSettledAt(pods, 3)).toBe(true);
  });

  it("the pod removed for 4 → 3 still terminating: not settled, though three are not deleting", () => {
    const pods = [pod("agboss-worker-a"), pod("agboss-worker-b"), pod("agboss-worker-c"), pod("agboss-worker-d", true)];
    expect(workersSettledAt(pods, 3)).toBe(false);
  });

  it("a deleting pod among three: not settled", () => {
    expect(workersSettledAt([pod("agboss-worker-a"), pod("agboss-worker-b"), pod("agboss-worker-c", true)], 3)).toBe(false);
  });
});
