import { cpSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export interface PackedManifest {
  readonly createdAt: string;
  readonly sourceCommit: string;
  readonly packages: {
    readonly agboss: {
      readonly name: string;
      readonly version: string;
      readonly filename: string;
      readonly tarballPath: string;
      readonly shasum: string;
      readonly integrity: string;
    };
    readonly agbossCli: {
      readonly name: string;
      readonly version: string;
      readonly filename: string;
      readonly tarballPath: string;
      readonly shasum: string;
      readonly integrity: string;
    };
  };
}

export interface IsolatedProjectHandle {
  readonly dir: string;
  readonly substitutions: readonly string[];
  cleanup(): void;
}

/**
 * Reads `.packed/manifest.json` from the repository root if packed tarballs were built.
 */
export function readPackedManifest(repoRoot: string): PackedManifest | undefined {
  const manifestPath = join(repoRoot, ".packed", "manifest.json");
  if (!existsSync(manifestPath)) return undefined;
  return JSON.parse(readFileSync(manifestPath, "utf8")) as PackedManifest;
}

/**
 * Creates a clean temporary directory outside the repository tree (Section 4.3).
 */
export function createIsolatedDirectory(prefix = "agboss-isolated-"): IsolatedProjectHandle {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  const substitutions: string[] = [];
  return {
    dir,
    substitutions,
    cleanup(): void {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/**
 * Copies a template or generated project into an isolated directory and, when a packed manifest
 * is provided, rewrites `@agboss/core` and `@agboss/cli` version specs in `package.json` to point to
 * the exact local `.tgz` tarballs while recording the substitution (Section 4.3).
 */
export function substitutePackedTarballs(
  projectDir: string,
  manifest: PackedManifest,
): readonly string[] {
  const pkgPath = join(projectDir, "package.json");
  if (!existsSync(pkgPath)) return [];
  const raw = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    overrides?: Record<string, string>;
  };
  const recorded: string[] = [];
  const agbossTar = `file:${resolve(manifest.packages.agboss.tarballPath)}`;
  const cliTar = `file:${resolve(manifest.packages.agbossCli.tarballPath)}`;

  if (raw.dependencies?.["@agboss/core"] !== undefined) {
    recorded.push(`dependencies.@agboss/core: ${raw.dependencies["@agboss/core"]} -> ${agbossTar}`);
    raw.dependencies["@agboss/core"] = agbossTar;
  }
  if (raw.devDependencies?.["@agboss/cli"] !== undefined) {
    recorded.push(
      `devDependencies.@agboss/cli: ${raw.devDependencies["@agboss/cli"]} -> ${cliTar}`,
    );
    raw.devDependencies["@agboss/cli"] = cliTar;
  }
  if (raw.devDependencies?.["typescript-eslint"] === "^8.70.0") {
    recorded.push("devDependencies.typescript-eslint: ^8.70.0 -> ^8.0.0");
    raw.devDependencies["typescript-eslint"] = "^8.0.0";
  }
  if (raw.dependencies?.["@agboss/cli"] !== undefined) {
    recorded.push(`dependencies.@agboss/cli: ${raw.dependencies["@agboss/cli"]} -> ${cliTar}`);
    raw.dependencies["@agboss/cli"] = cliTar;
  }
  raw.overrides = {
    ...(raw.overrides ?? {}),
    "@agboss/core": agbossTar,
    "@agboss/cli": cliTar,
  };
  recorded.push(`overrides.@agboss/core -> ${agbossTar}`);
  writeFileSync(pkgPath, JSON.stringify(raw, null, 2) + "\n", "utf8");
  return recorded;
}

/**
 * Clones a project directory into an isolated temp workspace outside the repository.
 */
export function cloneToIsolatedDirectory(
  sourceDir: string,
  prefix = "agboss-project-",
): IsolatedProjectHandle {
  const handle = createIsolatedDirectory(prefix);
  cpSync(sourceDir, handle.dir, {
    recursive: true,
    filter: (src) => !src.includes("node_modules") && !src.includes(".agboss"),
  });
  return handle;
}
