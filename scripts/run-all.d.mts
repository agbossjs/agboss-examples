export type ScaffoldProvenanceMode = "rc" | "published";

export interface ScaffoldTestConfig {
  provenance: ScaffoldProvenanceMode;
  agbossSpec: string;
  cliSpec: string;
  useOverrides: boolean;
  expectedVersion: {
    agboss: string;
    agbossCli: string;
  };
  expectedIntegrity: {
    agboss: string;
    agbossCli: string;
  };
  expectedResolved: {
    agboss: string;
    agbossCli: string;
  };
}

export interface VerifiedScaffoldPackageInfo {
  version: string;
  resolved: string;
  integrity: string;
  realpath: string;
}

export interface VerifiedScaffoldInstalledPackages {
  agboss: VerifiedScaffoldPackageInfo;
  agbossCli: VerifiedScaffoldPackageInfo;
}

export function resolvePortablePackedTarballPath(
  repoRoot: string,
  filename: string,
  packageLabel?: string,
): string;

export function resolveScaffoldTestConfig(options: {
  projectRoot: string;
  repoRoot: string;
  env?: NodeJS.ProcessEnv;
}): ScaffoldTestConfig;

export function verifyScaffoldInstalledPackages(options: {
  appDir: string;
  config: ScaffoldTestConfig;
}): VerifiedScaffoldInstalledPackages;
