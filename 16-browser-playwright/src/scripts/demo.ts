/**
 * `npm run demo` (offline, $0) and `npm run demo:live` (OpenRouter, `OPENROUTER_API_KEY`): a browser
 * plugged into an agent two ways, against the local test site (no internet).
 *
 *   Way A (plain Playwright, @Tool): read the pricing page, look at the home page's screenshot (it
 *     reaches the model as an image part), file a contact request, then try 127.0.0.1 — refused.
 *   Way B (@playwright/mcp behind @McpServer): read the pricing page, file a contact request.
 *
 * Offline, the models are `offline/offline-openrouter.ts` served on 127.0.0.1; live, they are a cheap
 * OpenRouter model. Every number printed is read from the executions and the site's own records; the
 * demo checks what it prints (offline) and exits non-zero when a promise does not hold.
 */
import { createApp, type ExecutionOutput } from "@agboss/core";
import { isLiveDemoRequested, requireLiveApiKey, serveFetch, setProcessEnv } from "../../../scripts/tooling/offline-transports.js";
import "./offline-keys.js"; // synthetic keys, unless your own are set (R6)
import { BrowserPlaywrightApplication } from "../browser-playwright.application.js";
import { SharedBrowser } from "../browser/shared-browser.service.js";
import { createOfflineOpenRouter, hasImagePart } from "../offline/offline-openrouter.js";
import { startRunningSite } from "../site/site-environment.js";
import { AskWorkflowStart } from "../workflows/web/ask.workflow-start.js";
import { McpAskWorkflowStart } from "../workflows/mcp-web/mcp-ask.workflow-start.js";

const isLive = isLiveDemoRequested();

function check(condition: boolean, what: string): void {
  if (!condition && !isLive) throw new Error(`demo check failed: ${what}`);
}

const answerOf = (result: ExecutionOutput): string => (result.output as { text: string }).text;

const running = await startRunningSite();
const openRouter = createOfflineOpenRouter();
const served = isLive ? undefined : await serveFetch(openRouter.fetch);
const restoreEnv = setProcessEnv({
  ...running.variables,
  OPENROUTER_API_KEY: isLive ? requireLiveApiKey() : "offline",
  ...(served === undefined ? {} : { OPENROUTER_BASE_URL: served.baseUrl }),
});
const app = await createApp(BrowserPlaywrightApplication);
const browser = app.resolve(SharedBrowser);

try {
  console.log(`browser-playwright demo — ${isLive ? "live (OpenRouter)" : "offline ($0)"}; the site: ${running.origin}\n`);
  const { origin } = running;

  const pricing = await app.execute(AskWorkflowStart, { text: `Open ${origin}/pricing and tell me the Starter price.` });
  console.log(`Way A, open-page-tool\n  agent: ${answerOf(pricing)}`);
  check(answerOf(pricing).includes("12 USD"), "way A read the Starter price from the page");

  const shot = await app.execute(AskWorkflowStart, { text: `Take a screenshot of ${origin}/ and describe it.` });
  console.log(`Way A, screenshot-tool\n  agent: ${answerOf(shot)}`);
  check(openRouter.requests.some((request) => hasImagePart(request.messages)), "the screenshot reached the model as an image part");

  const filed = await app.execute(AskWorkflowStart, {
    text: "File a request with the support desk: reference=callback-1; name=Ada; email=ada@example.com; message=Please call me back about the Team plan.",
  });
  console.log(`Way A, submit-contact-tool\n  agent: ${answerOf(filed)}`);
  check(running.site.tickets.length === 1, "one ticket on the site");

  const refused = await app.execute(AskWorkflowStart, { text: `Open ${running.site.loopbackUrl}/secret and read it.` });
  console.log(`Way A, 127.0.0.1 is not an allowed site\n  agent: ${answerOf(refused)}`);
  check(!running.site.requests.some((request) => request.endsWith("/secret")), "the site never received a request for /secret");

  const viaMcp = await app.execute(McpAskWorkflowStart, { text: `Open ${origin}/pricing and tell me the Starter price.` });
  console.log(`Way B, open-page-mcp-tool (@playwright/mcp)\n  agent: ${answerOf(viaMcp)}`);
  check(answerOf(viaMcp).includes("12 USD"), "way B read the Starter price through the MCP server");

  const filedViaMcp = await app.execute(McpAskWorkflowStart, {
    text: "File a request with the support desk: reference=callback-2; name=Grace; email=grace@example.com; message=Do you have an annual plan?",
  });
  console.log(`Way B, submit-contact-mcp-tool\n  agent: ${answerOf(filedViaMcp)}`);
  check(running.site.tickets.length === 2, "two tickets on the site, one per reference");

  console.log(`\nthe site's tickets: ${running.site.tickets.map((ticket) => `${ticket.id} (${ticket.reference})`).join(", ")}`);
  console.log(`the site's requests: ${String(running.site.requests.length)}; none for /secret`);
  const spend = [pricing, shot, filed, refused, viaMcp, filedViaMcp].reduce((sum, run) => sum + run.spend.totalUsd, 0);
  console.log(`spend: $${spend.toFixed(6)}`);
} finally {
  await app.close();
  // the application stopped: onDestroy closed the shared browser
  console.log(`browser still open after app.close(): ${String(await browser.handle.isOpen)}`);
  check(!(await browser.handle.isOpen), "the shared browser is closed when the application stops");
  await served?.close();
  await running.site.stop();
  restoreEnv();
}
if (!isLive) console.log("\nAll checks passed.");
