import { createPrivateKey, createPublicKey } from "node:crypto";
import type { Secret } from "agboss";

const deterministicSeedKey = createPrivateKey({
  key: Buffer.from(
    `302e020100300506032b657004220420${"42".repeat(32)}`,
    "hex",
  ),
  format: "der",
  type: "pkcs8",
});

export const DEFAULT_MESH_PRIVATE_KEY_PEM = deterministicSeedKey
  .export({ format: "pem", type: "pkcs8" })
  .toString();

export const DEFAULT_MESH_PUBLIC_KEY_PEM = createPublicKey(deterministicSeedKey)
  .export({ format: "pem", type: "spki" })
  .toString();

process.env.PII_PSEUDONYM_KEY ??= "test-mesh-pseudonym-key-32-bytes-minimum!";
process.env.MESH_SIGNING_KEY ??= DEFAULT_MESH_PRIVATE_KEY_PEM;
process.env.OPENROUTER_API_KEY ??=
  process.env.OPEN_ROUTER_KEY ?? "offline-test-openrouter-api-key";

export class AppEnvironment {
  sqlitePath!: string;
  piiPseudonymKey?: Secret;
  meshSigningKey!: Secret;
  triageVerifyKey!: string;
  billingVerifyKey!: string;
  openRouterApiKey!: Secret;
}
