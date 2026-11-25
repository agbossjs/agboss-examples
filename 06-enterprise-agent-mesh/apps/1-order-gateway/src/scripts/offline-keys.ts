/**
 * Synthetic keys for the offline demos, the federation proof and the tests only (R6): the applications read
 * them through `secret(…)` and fail closed at start when a variable is not set. Never import this from `src/`
 * outside `scripts/`. One Ed25519 pair stands for every application of the mesh (a seed of 0x42 bytes), so the
 * signing key of each one is the verify key of the others.
 */
import { createPrivateKey, createPublicKey } from "node:crypto";

const seedKey = createPrivateKey({
  key: Buffer.from(`302e020100300506032b657004220420${"42".repeat(32)}`, "hex"),
  format: "der",
  type: "pkcs8",
});

/** The variables the three applications read, with synthetic values. */
export const OFFLINE_KEYS: Readonly<Record<string, string>> = {
  PII_PSEUDONYM_KEY: "enterprise-mesh-synthetic-pseudonym-key-32-bytes!",
  AGBOSS_IDEMPOTENCY_SECRET: "enterprise-mesh-synthetic-idempotency-secret-32b",
  MESH_SIGNING_KEY: seedKey.export({ format: "pem", type: "pkcs8" }).toString(),
  TRIAGE_VERIFY_KEY: createPublicKey(seedKey).export({ format: "pem", type: "spki" }).toString(),
  BILLING_VERIFY_KEY: createPublicKey(seedKey).export({ format: "pem", type: "spki" }).toString(),
  BILLING_API_KEY: "key-acme",
  BILLING_READONLY_API_KEY: "key-readonly",
  CATALOG_READER_API_KEY: "key-catalog-reader",
  OPENROUTER_API_KEY: "offline-test-openrouter-api-key",
};

for (const [name, value] of Object.entries(OFFLINE_KEYS)) {
  process.env[name] ??= value;
}
