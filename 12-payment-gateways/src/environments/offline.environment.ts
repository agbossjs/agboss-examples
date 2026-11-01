import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

// synthetic, offline values — never a real key (R6)
process.env.PII_PSEUDONYM_KEY ??= "payment-gateways-offline-pseudonym-key!";
process.env.GATEWAY_STUB_URL ??= "http://127.0.0.1:9";

/** Offline: a fresh SQLite file per application (two instances of one test share it), the stub's URL. */
export const environment: AppEnvironment = {
  get sqlitePath(): string {
    return join(mkdtempSync(join(tmpdir(), "payment-gateways-")), "stores.sqlite");
  },
  gatewayStubUrl: env("GATEWAY_STUB_URL"),
  gatewayStubCa: env.optional("GATEWAY_STUB_CA"),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
};
