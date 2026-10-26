import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { secret } from "@agboss/core";

process.env.PII_PSEUDONYM_KEY ??= "cluster-work-stealing-pseudonym-key-32b!!";

export const environment = {
  get sqlitePath(): string {
    const dir = mkdtempSync(join(tmpdir(), "agboss-cluster-test-"));
    return join(dir, "cluster.sqlite");
  },
  piiPseudonymKey: secret("PII_PSEUDONYM_KEY"),
  openRouterApiKey: secret("OPENROUTER_API_KEY"),
};
