// Builds the pods' image `agboss-scaling:local` (agbossjs/agboss#487) from what the project runs on:
// `dist/` compiled by tsc, and the installed @agboss/core and @agboss/postgres packed back into
// tarballs (`npm pack <installed folder>`), so the image holds exactly the release the tests ran —
// the packed candidate before 0.1.1 is published, the registry's after. Then loads it into kind.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLUSTER, PROJECT, log, output, run } from "./kube.mjs";

const IMAGE = "agboss-scaling:local";
const STAGE = join(PROJECT, ".artifacts", "image");
const MINIMUM_RELEASE_AGE_DAYS = 3; // agbossjs/agboss#523, as the examples' installs

export function buildImage({ load = true } = {}) {
  log("compiling dist/ (tsc -p tsconfig.build.json)");
  rmSync(join(PROJECT, "dist"), { recursive: true, force: true });
  run("npx", ["tsc", "-p", "tsconfig.build.json"]);
  rmSync(STAGE, { recursive: true, force: true });
  mkdirSync(join(STAGE, "vendor"), { recursive: true });
  cpSync(join(PROJECT, "dist"), join(STAGE, "dist"), { recursive: true });
  cpSync(join(PROJECT, "deploy", "Dockerfile"), join(STAGE, "Dockerfile"));

  const project = JSON.parse(readFileSync(join(PROJECT, "package.json"), "utf8"));
  const dependencies = { ...project.dependencies };
  const overrides = {};
  for (const name of ["@agboss/core", "@agboss/postgres"]) {
    const installed = join(PROJECT, "node_modules", ...name.split("/"));
    if (!existsSync(join(installed, "package.json")))
      throw new Error(`${name} is not installed in ${PROJECT}: run npm install (or npm run install:packed at the repository root)`);
    const before = new Set(readdirSync(join(STAGE, "vendor")));
    output("npm", ["pack", installed, "--ignore-scripts", "--pack-destination", join(STAGE, "vendor")]);
    const [tarball] = readdirSync(join(STAGE, "vendor")).filter((file) => !before.has(file));
    dependencies[name] = `file:vendor/${tarball}`;
    overrides[name] = `file:vendor/${tarball}`;
  }
  writeFileSync(
    join(STAGE, "package.json"),
    `${JSON.stringify({ name: project.name, version: project.version, private: true, type: "module", dependencies, overrides }, null, 2)}\n`,
  );
  const npmBefore = new Date(Date.now() - MINIMUM_RELEASE_AGE_DAYS * 24 * 3600 * 1000).toISOString();
  log(`docker build ${IMAGE} (npm install --before=${npmBefore})`);
  run("docker", ["build", "--build-arg", `NPM_BEFORE=${npmBefore}`, "-t", IMAGE, STAGE]);
  if (load) {
    log(`kind load docker-image ${IMAGE}`);
    run("kind", ["load", "docker-image", IMAGE, "--name", CLUSTER]);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) buildImage({ load: !process.argv.includes("--no-load") });
