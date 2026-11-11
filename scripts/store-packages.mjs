/**
 * The store packages the examples install packed until they are on npm (agbossjs/agboss#487,
 * #891): the key each is pinned under in `.agboss-version.json` (`{ repository, sha }`), its npm
 * name, its repository under agbossjs, the variable naming a local checkout of it, the store bundle
 * an application spreads into its providers and its command, if it has one — what
 * `verify-published` probes in an isolated consumer.
 */
export const STORE_PACKAGES = [
  {
    key: "postgres",
    name: "@agboss/postgres",
    repo: "postgres",
    env: "AGBOSS_POSTGRES_DIR",
    bundle: "POSTGRES_STORES",
    bin: "agboss-postgres",
  },
  {
    key: "mongodb",
    name: "@agboss/mongodb",
    repo: "mongodb",
    env: "AGBOSS_MONGODB_DIR",
    bundle: "MONGODB_STORES",
    bin: "agboss-mongodb",
  },
  {
    key: "redis",
    name: "@agboss/redis",
    repo: "redis",
    env: "AGBOSS_REDIS_DIR",
    bundle: "REDIS_COORDINATION_STORES",
  },
];

/**
 * The store packages `pack-framework` packs: every one the pin lists, or — with
 * `AGBOSS_PACK_STORES` (`only`, a comma list) — those it names. A name the pin does not list is an
 * error, never a silent skip.
 */
export function storesToPack(pin, only) {
  const keys = only?.split(",").map((key) => key.trim()).filter(Boolean);
  for (const key of keys ?? []) {
    if (pin?.[key] === undefined) {
      throw new Error(`[pack-framework] AGBOSS_PACK_STORES names ${key}, which .agboss-version.json does not pin`);
    }
  }
  return STORE_PACKAGES.filter(
    (store) => pin?.[store.key] !== undefined && (keys === undefined || keys.includes(store.key)),
  );
}

/** The store packages a pack manifest holds (`.packed/manifest.json` `packages.<key>`), in table order. */
export const packedStoresOf = (manifest) =>
  STORE_PACKAGES.flatMap((store) => {
    const packed = manifest?.packages?.[store.key];
    return packed === undefined ? [] : [{ store, packed }];
  });

/**
 * The probe an isolated consumer runs for the packed store packages: each imports, and its bundle is
 * a non-empty array of classes. Prints `{ "verified": [names] }`; throws naming the first one wrong.
 */
export function storeProbeScriptOf(stores) {
  const probes = stores.map(({ name, bundle }) => ({ name, bundle }));
  return `
    const probes = ${JSON.stringify(probes)};
    const verified = [];
    for (const { name, bundle } of probes) {
      const mod = await import(name);
      const stores = mod[bundle];
      if (!Array.isArray(stores) || stores.length === 0 || !stores.every((one) => typeof one === "function")) {
        throw new Error(\`\${name}: \${bundle} is not a non-empty array of store classes\`);
      }
      verified.push(name);
    }
    console.log(JSON.stringify({ verified }));
  `;
}
