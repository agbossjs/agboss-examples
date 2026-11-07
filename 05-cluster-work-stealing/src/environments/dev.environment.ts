import { env, secret } from "@agboss/core";

process.env.PII_PSEUDONYM_KEY ??= "cluster-work-stealing-pseudonym-key-32b!!";
process.env.IDEMPOTENCY_KEY ??= "cluster-work-stealing-offline-idempotency-key";

export const environment = {
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  idempotencyKey: secret("IDEMPOTENCY_KEY"),
};
