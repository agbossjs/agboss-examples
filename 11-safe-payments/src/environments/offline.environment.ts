import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env, secret } from "@agboss/core";
import type { AppEnvironment } from "./app.environment.js";

// synthetic, offline values — never a real key (R6)
process.env.PII_PSEUDONYM_KEY ??= "safe-payments-offline-pseudonym-key-32b!";
process.env.STUB_WEBHOOK_SECRET ??= "set-by-the-stub-gateway-at-start";
process.env.STUB_GATEWAY_URL ??= "http://127.0.0.1:9";
// the agents' model provider needs a key to be built; nothing here ever calls a model (every turn
// is scripted), so it gets a placeholder under a name of its own — never a real key's variable
process.env.SAFE_PAYMENTS_UNUSED_MODEL_KEY ??= "offline-no-model-is-ever-called";

/**
 * The offline environment: a fresh SQLite file per application (two instances of one test share
 * it), or `SAFE_PAYMENTS_SQLITE_PATH` — what the two processes of PS2 / PS5 open together.
 */
export const environment: AppEnvironment = {
  get sqlitePath(): string {
    const shared = process.env.SAFE_PAYMENTS_SQLITE_PATH;
    if (shared !== undefined && shared !== "") return shared;
    return join(mkdtempSync(join(tmpdir(), "safe-payments-")), "stores.sqlite");
  },
  stubGatewayUrl: env("STUB_GATEWAY_URL"),
  stubWebhookSecret: secret("STUB_WEBHOOK_SECRET"),
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  openRouterApiKey: secret("SAFE_PAYMENTS_UNUSED_MODEL_KEY"),
};
