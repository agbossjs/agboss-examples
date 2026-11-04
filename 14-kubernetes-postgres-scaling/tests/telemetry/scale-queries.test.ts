/**
 * agbossjs/agboss#486 AC3 — the shipped autoscaling configs scale on the documented signals
 * (Wiki → Metrics): out on slot demand — `max` over pods for the cluster's queued children, `sum` for
 * the pods' busy and waiting steps, per pod's four slots —, never a `sum` of a cluster gauge; and the
 * pod's grace covers the app's stop; and (agbossjs/agboss#751) never fewer than one pod — idle does
 * not see a root handed over or left by a crash, which only a live pod's recovery sweep continues.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DEMAND =
  "max(agboss_cluster_children_queued) + sum(agboss_instance_steps_waiting) + sum(agboss_instance_step_slots_busy)";
const read = (file: string): string => readFileSync(new URL(`../../deploy/${file}`, import.meta.url), "utf8");
const oneLine = (text: string): string => text.replace(/\s+/gu, " ");

describe("AC3: the scale rules are the documented ones", () => {
  it("KEDA and the prometheus-adapter scale out on slot demand, target four slots per pod", () => {
    const keda = oneLine(read("keda-scaledobject.yaml"));
    const adapter = oneLine(read("prometheus-adapter-values.yaml"));
    const hpa = oneLine(read("hpa-prometheus-adapter.yaml"));

    expect(keda).toContain(DEMAND);
    expect(keda).toContain('threshold: "4"');
    expect(adapter).toContain(DEMAND);
    expect(hpa).toContain('averageValue: "4"');
  });

  it("no config sums a cluster gauge", () => {
    for (const file of ["keda-scaledobject.yaml", "prometheus-adapter-values.yaml", "collector/containerapps-keda.yaml"])
      expect(oneLine(read(file))).not.toMatch(/sum\(\s*agboss_cluster_/u);
  });

  it("the pod's grace covers the preStop sleep and the app's 30 s shutdownTimeout", () => {
    const worker = read("worker-deployment.yaml");
    const grace = Number(/terminationGracePeriodSeconds: (\d+)/u.exec(worker)?.[1]);
    const preStop = Number(/sleep", "(\d+)"/u.exec(worker)?.[1]);

    expect(grace).toBeGreaterThan(preStop + 30);
  });

  it("agbossjs/agboss#751: never scaled to zero — every config keeps at least one pod", () => {
    const floors = [
      /minReplicaCount: (\d+)/u.exec(read("keda-scaledobject.yaml"))?.[1],
      /minReplicas: (\d+)/u.exec(read("hpa-prometheus-adapter.yaml"))?.[1],
    ].map(Number);

    expect(floors).toEqual([1, 1]);
    expect(read("keda-scaledobject.yaml")).not.toMatch(/0 is possible/u);
  });
});
