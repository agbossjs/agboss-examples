import { afterAll, beforeAll, vi } from "vitest";
import { ContactSite } from "../../src/site/contact-site.js";
import { startRunningSite, type RunningSite } from "../../src/site/site-environment.js";

// the `offline` environment (two instances on one SQLite file) needs a key to build its model provider;
// no test that uses it calls a model
process.env.OPENROUTER_API_KEY ??= "offline-no-model-is-called";

/**
 * The local test site for one test file: started before the file's applications are made, the
 * variables that point the application and the MCP server's child at it set in `process.env` (what
 * `test.environment.ts` reads), restored and the site stopped after. No internet, no real model.
 */
export function siteForFile(): { readonly site: () => ContactSite; readonly running: () => RunningSite } {
  let running: RunningSite | undefined;
  beforeAll(async () => {
    running = await startRunningSite();
    for (const [name, value] of Object.entries(running.variables)) vi.stubEnv(name, value);
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await running?.site.stop();
  });
  const started = (): RunningSite => {
    if (running === undefined) throw new Error("the site starts in beforeAll");
    return running;
  };
  return { site: () => started().site, running: started };
}
