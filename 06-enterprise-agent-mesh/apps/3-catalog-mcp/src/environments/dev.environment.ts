import { createPrivateKey, createPublicKey } from "node:crypto";
import { env, secret } from "agboss";

const deterministicSeedKey = createPrivateKey({
  key: Buffer.from(
    `302e020100300506032b657004220420${"42".repeat(32)}`,
    "hex",
  ),
  format: "der",
  type: "pkcs8",
});
const privateKeyPem = deterministicSeedKey
  .export({ format: "pem", type: "pkcs8" })
  .toString();
const publicKeyPem = createPublicKey(deterministicSeedKey)
  .export({ format: "pem", type: "spki" })
  .toString();

process.env.PII_PSEUDONYM_KEY ??= "dev-mesh-pseudonym-key-32-bytes-minimum!!";
process.env.MESH_SIGNING_KEY ??= privateKeyPem;

export const environment = {
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  meshSigningKey: secret("MESH_SIGNING_KEY"),
  triageVerifyKey: env("TRIAGE_VERIFY_KEY", { default: publicKeyPem }),
  billingVerifyKey: env("BILLING_VERIFY_KEY", { default: publicKeyPem }),
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
};
