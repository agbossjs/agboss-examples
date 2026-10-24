export type ProjectPriority = "P0" | "P1";

export type ProjectStatus = "passed" | "failed" | "skipped";

export interface ProjectProofResult {
  readonly project: string;
  readonly priority: ProjectPriority;
  readonly primaryProof: string;
  readonly mode: "offline-deterministic" | "model-assisted" | "fault-injection" | "multi-service";
  readonly checkStatus: ProjectStatus;
  readonly testStatus: ProjectStatus;
  readonly durationMs: number;
  readonly details?: string;
}

export interface ProofSuiteReport {
  readonly schemaVersion: "1.0";
  readonly generatedAt: string;
  readonly nodeVersion: string;
  readonly frameworkVersion: string;
  readonly cliVersion: string;
  readonly sourceCommit: string;
  readonly packageHashes: {
    readonly agboss?: string;
    readonly agbossCli?: string;
  };
  readonly results: readonly ProjectProofResult[];
  readonly allP0Passed: boolean;
}
