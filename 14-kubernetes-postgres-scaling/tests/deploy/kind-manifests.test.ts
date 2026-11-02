/**
 * agbossjs/agboss#487 — the kind blueprint stays inside its budget and keeps its promises: every
 * container has requests and limits, the requests fit the 3 CPU / 4 GB node, PostgreSQL stays at
 * ≤ 500m / 512Mi, at most 4 workers, every image pinned, the pods' grace above preStop +
 * shutdownTimeout, and a liveness window wider than a frozen pod's takeover (30 s lease + 30 s sweep).
 */
import { readFileSync } from "node:fs";
import { parseAllDocuments } from "yaml";
import { describe, expect, it } from "vitest";

const read = (file: string): string => readFileSync(new URL(`../../deploy/${file}`, import.meta.url), "utf8");
interface Quantity {
  readonly cpu: string;
  readonly memory: string;
}
interface Container {
  readonly name: string;
  readonly image: string;
  readonly resources: { readonly requests: Quantity; readonly limits: Quantity };
  readonly livenessProbe?: { readonly periodSeconds: number; readonly failureThreshold: number };
  readonly lifecycle?: { readonly preStop: { readonly exec: { readonly command: readonly string[] } } };
}
/** The parts of a manifest the checks read. */
interface Doc {
  readonly kind: string;
  readonly metadata?: { readonly name?: string };
  readonly spec?: {
    readonly maxReplicaCount?: number;
    readonly template?: { readonly spec?: { readonly containers?: readonly Container[]; readonly terminationGracePeriodSeconds?: number } };
    readonly advanced?: {
      readonly horizontalPodAutoscalerConfig: { readonly behavior: { readonly scaleDown: { readonly stabilizationWindowSeconds: number } } };
    };
  };
}
const docsOf = (file: string): Doc[] => parseAllDocuments(read(file)).map((doc) => doc.toJSON() as Doc);

const MANIFESTS = ["kind/infra.yaml", "kind/migrate-job.yaml", "kind/load-job.yaml", "kind/apps/coordinator.yaml", "kind/monitoring/prometheus.yaml"];
const containersOf = (doc: Doc | undefined): readonly Container[] => doc?.spec?.template?.spec?.containers ?? [];
const cpu = (value: string): number => (value.endsWith("m") ? Number(value.slice(0, -1)) / 1000 : Number(value));
const mebibytes = (value: string): number => (value.endsWith("Gi") ? Number(value.slice(0, -2)) * 1024 : Number(value.slice(0, -2)));

describe("the kind blueprint's budget", () => {
  const workloads = MANIFESTS.flatMap(docsOf).filter((doc) => containersOf(doc).length > 0);
  const [workerPatch] = docsOf("kind/apps/worker-patch.yaml");
  const [scaled] = docsOf("kind/apps/scaledobject-patch.yaml");
  const [coordinator] = docsOf("kind/apps/coordinator.yaml");

  it("every container has requests and limits", () => {
    const quantity = /^\d+(m|Mi|Gi)?$/u;
    for (const doc of [...workloads, workerPatch])
      for (const container of containersOf(doc)) {
        const { requests, limits } = container.resources;
        for (const value of [requests.cpu, requests.memory, limits.cpu, limits.memory])
          expect(value, `${String(doc?.metadata?.name)}/${container.name}`).toMatch(quantity);
      }
  });

  it("the requests of everything, with 4 workers, fit the 3 CPU / 4 GB node", () => {
    const maxWorkers = Number(scaled?.spec?.maxReplicaCount);
    const worker = containersOf(workerPatch)[0]?.resources.requests ?? { cpu: "1", memory: "1Gi" };
    const services = workloads.filter((doc) => doc.kind === "Deployment").flatMap(containersOf).map((container) => container.resources.requests);
    const cpus = services.reduce((sum, request) => sum + cpu(request.cpu), 0) + maxWorkers * cpu(worker.cpu);
    const memory = services.reduce((sum, request) => sum + mebibytes(request.memory), 0) + maxWorkers * mebibytes(worker.memory);

    expect(maxWorkers).toBeLessThanOrEqual(4);
    expect(cpus).toBeLessThan(2); // the control plane and KEDA take the rest of the 3
    expect(memory).toBeLessThan(2 * 1024);
  });

  it("PostgreSQL stays at ≤ 500m / 512Mi", () => {
    const postgres = docsOf("kind/infra.yaml").find((doc) => doc.kind === "Deployment" && doc.metadata?.name === "postgres");
    expect(containersOf(postgres)[0]?.resources.limits).toEqual({ cpu: "500m", memory: "512Mi" });
  });

  it("every image is pinned: the local build, or a version with its digest", () => {
    const images = [...workloads.flatMap(containersOf), ...containersOf(workerPatch)].map((container) => container.image);
    for (const image of images) expect(image === "agboss-scaling:local" || /:[\w.-]+@sha256:[0-9a-f]{64}$/u.test(image), image).toBe(true);
    expect(read("kind/cluster.yaml")).toMatch(/kindest\/node:v1\.35\.\d+@sha256:[0-9a-f]{64}/u);
    expect(read("Dockerfile")).toMatch(/^FROM node:22\.\d+\.\d+-alpine@sha256:[0-9a-f]{64}$/mu);
  });

  it("the coordinator's grace covers its preStop and the app's 30 s shutdownTimeout, like the workers'", () => {
    const grace = Number(coordinator?.spec?.template?.spec?.terminationGracePeriodSeconds);
    const preStop = Number(containersOf(coordinator)[0]?.lifecycle?.preStop.exec.command[1]);
    expect(grace).toBeGreaterThan(preStop + 30);
  });

  it("a frozen pod is not restarted before another took its leases over (30 s lease + 30 s sweep)", () => {
    for (const container of [containersOf(workerPatch)[0], containersOf(coordinator)[0]]) {
      const probe = container?.livenessProbe ?? { periodSeconds: 0, failureThreshold: 0 };
      expect(probe.periodSeconds * probe.failureThreshold).toBeGreaterThan(30 + 30);
    }
  });

  it("the scale-in here is fast to watch; the shipped ScaledObject keeps production's 300 s", () => {
    expect(scaled?.spec?.advanced?.horizontalPodAutoscalerConfig.behavior.scaleDown.stabilizationWindowSeconds).toBe(30);
    expect(read("keda-scaledobject.yaml")).toContain("stabilizationWindowSeconds: 300");
  });
});
