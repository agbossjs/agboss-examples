// agbossjs/agboss#785 AC1: the fill checks of the scenario measure live pods, their claims counted
// by the leases they hold too — a killed pod's stale series and a claimed child between two steps
// no longer read as empty slots; a pod that really leaves its slots empty still does.
import { describe, expect, it } from "vitest";
import { slotFillOf, type FillSample } from "../../scripts/cluster/fill.mjs";

/** A sample at `t` with `queued` children waiting and, per pod, `[busy, slots, held]`. */
function sample(t: number, queued: number, pods: Record<string, [number, number, number?]>): FillSample {
  const entries = Object.entries(pods);
  return {
    t,
    queued,
    podBusy: Object.fromEntries(entries.map(([pod, [busy]]) => [pod, busy])),
    podSlots: Object.fromEntries(entries.map(([pod, [, slots]]) => [pod, slots])),
    podHeld: Object.fromEntries(entries.map(([pod, [busy, , held]]) => [pod, held ?? busy])),
  };
}

const window = { from: 0, to: 100 };

describe("#785: the scenario's slot fill", () => {
  it("a killed pod's last series is left out from its kill (examples#48's first failure)", () => {
    const timeline = [
      sample(10, 60, { a: [4, 4], victim: [4, 4] }),
      ...[32, 34, 36, 38].map((t) => sample(t, 40, { a: [4, 4], victim: [1, 4] })),
    ];

    expect(slotFillOf(timeline, window).podFill).toBeLessThan(0.9);
    const fill = slotFillOf(timeline, { ...window, gone: [{ pod: "victim", from: 32 }] });
    expect(fill.podFill).toBe(1);
    expect(fill.podSamples).toBe(6);
  });

  it("a pod whose claimed children sit between two steps is full by its leases (examples#48's second failure)", () => {
    const timeline = [11, 13, 15].map((t) => sample(t, 68, { a: [2, 4, 4], b: [2, 4, 4] }));

    const fill = slotFillOf(timeline, window);

    expect(fill.podFill).toBe(1);
    expect(fill.clusterFill).toBe(0.5);
  });

  it("a live pod that really leaves its slots empty still fails the check", () => {
    const timeline = [10, 12, 14, 16].map((t) => sample(t, 60, { a: [4, 4], short: [1, 4, 1] }));

    expect(slotFillOf(timeline, window).podFill).toBeLessThan(0.9);
  });

  it("the longest idle run: nothing claimed while at least its slots were queued; a claim is not idle", () => {
    const idle = [0, 2, 4, 6].map((t) => sample(t, 40, { a: [4, 4], idle: [0, 4, 0] }));
    const claimed = [8, 10].map((t) => sample(t, 40, { a: [4, 4], idle: [0, 4, 2] }));

    const fill = slotFillOf([...idle, ...claimed], window);

    expect(fill.longestIdle).toEqual({ idle: 6 });
    expect([fill.idlest, fill.idleFor]).toEqual(["idle", 6]);
  });

  it("only samples with at least the live pods' slots queued count", () => {
    const timeline = [sample(2, 3, { a: [1, 4] }), sample(4, 8, { a: [4, 4], b: [4, 4] })];

    expect(slotFillOf(timeline, window).samples).toBe(1);
  });
});
