// agbossjs/agboss#891: the store packages the examples pack, install and verify.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { packedStoresOf, STORE_PACKAGES, storeProbeScriptOf, storesToPack } from "./store-packages.mjs";

const PIN = {
  postgres: { repository: "agbossjs/postgres", sha: "a".repeat(40) },
  mongodb: { repository: "agbossjs/mongodb", sha: "b".repeat(40) },
  redis: { repository: "agbossjs/redis", sha: "c".repeat(40) },
};

/** A consumer folder with one fake package per entry: `{ name, source }`. */
function consumerWith(packages) {
  const dir = mkdtempSync(join(tmpdir(), "store-probe-"));
  for (const { name, source } of packages) {
    const at = join(dir, "node_modules", ...name.split("/"));
    mkdirSync(at, { recursive: true });
    writeFileSync(join(at, "package.json"), JSON.stringify({ name, type: "module", main: "index.js" }));
    writeFileSync(join(at, "index.js"), source);
  }
  return dir;
}

describe("#891: the store packages", () => {
  it("lists postgres, mongodb and redis, each with its bundle; the two databases with their command", () => {
    assert.deepEqual(
      STORE_PACKAGES.map((store) => [store.key, store.name, store.bundle, store.bin]),
      [
        ["postgres", "@agboss/postgres", "POSTGRES_STORES", "agboss-postgres"],
        ["mongodb", "@agboss/mongodb", "MONGODB_STORES", "agboss-mongodb"],
        ["redis", "@agboss/redis", "REDIS_COORDINATION_STORES", undefined],
      ],
    );
  });

  it("packs every pinned store, or only those AGBOSS_PACK_STORES names", () => {
    assert.deepEqual(storesToPack(PIN, undefined).map((store) => store.key), ["postgres", "mongodb", "redis"]);
    assert.deepEqual(storesToPack({ postgres: PIN.postgres }, undefined).map((store) => store.key), ["postgres"]);
    assert.deepEqual(storesToPack(PIN, "postgres").map((store) => store.key), ["postgres"]);
    assert.deepEqual(storesToPack(PIN, " redis , mongodb ").map((store) => store.key), ["mongodb", "redis"]);
  });

  it("refuses AGBOSS_PACK_STORES naming a store the pin does not list — never a silent skip", () => {
    assert.throws(() => storesToPack({ postgres: PIN.postgres }, "postgres,redis"), /names redis, which .* does not pin/);
  });

  it("reads the packed stores from a manifest, in table order, none when it has none", () => {
    const manifest = { packages: { agboss: {}, redis: { filename: "r.tgz" }, postgres: { filename: "p.tgz" } } };

    assert.deepEqual(packedStoresOf(manifest).map(({ store, packed }) => [store.key, packed.filename]), [
      ["postgres", "p.tgz"],
      ["redis", "r.tgz"],
    ]);
    assert.deepEqual(packedStoresOf({ packages: {} }), []);
  });

  it("the probe passes when each bundle is a non-empty array of classes", () => {
    const dir = consumerWith([{ name: "@agboss/redis", source: "export const REDIS_COORDINATION_STORES = [class A {}];" }]);
    writeFileSync(join(dir, "probe.mjs"), storeProbeScriptOf([STORE_PACKAGES[2]]));

    const out = execFileSync(process.execPath, ["probe.mjs"], { cwd: dir, encoding: "utf8" }).trim();

    assert.deepEqual(JSON.parse(out), { verified: ["@agboss/redis"] });
  });

  it("the probe fails naming the package whose bundle is missing or empty", () => {
    const dir = consumerWith([{ name: "@agboss/mongodb", source: "export const MONGODB_STORES = [];" }]);
    writeFileSync(join(dir, "probe.mjs"), storeProbeScriptOf([STORE_PACKAGES[1]]));

    assert.throws(
      () => execFileSync(process.execPath, ["probe.mjs"], { cwd: dir, encoding: "utf8", stdio: "pipe" }),
      (error) => String(error.stderr).includes("@agboss/mongodb: MONGODB_STORES is not a non-empty array"),
    );
  });
});
