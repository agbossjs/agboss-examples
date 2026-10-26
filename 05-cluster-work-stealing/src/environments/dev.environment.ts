import { env, secret } from "@agboss/core";

process.env.PII_PSEUDONYM_KEY ??= "cluster-work-stealing-pseudonym-key-32b!!";

export const environment = {
  sqlitePath: env("SQLITE_PATH", { default: ":memory:" }),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
};
