/**
 * `npm run demo` (offline, $0): the wiring of a stealth browser into an agent two ways, on a FAKE
 * browser (`BROWSER_FACTORY=fake`) — no Chrome, no display, no internet. Way A reads a page through
 * a `@Tool`; Way B reads it through the example's own MCP server (a child process); a URL outside the
 * allowlist is refused; the browser is closed when the application stops.
 *
 * `npm run demo:live` (OpenRouter key, real Google Chrome, a display): the same, the browser real and
 * headed, on `BROWSER_ALLOWED_ORIGINS` (default `https://example.org`) — one manual run, README §5.
 * Live, the demo checks nothing: a real site and a real model are not reproducible.
 */
import { createApp, type ExecutionOutput } from "@agboss/core";
import { isLiveDemoRequested, requireLiveApiKey, serveFetch, setProcessEnv } from "../../scripts/tooling/offline-transports.js";
import { createOfflineOpenRouter } from "./offline/offline-openrouter.js";

const isLive = isLiveDemoRequested();
const restoreEnv = setProcessEnv({
  ...(isLive ? {} : { BROWSER_FACTORY: "fake" }),
  PII_PSEUDONYM_KEY: process.env.PII_PSEUDONYM_KEY ?? "browser-bot-bypass-demo-synthetic-pseudonym-key", // synthetic unless set (R6)
  OPENROUTER_API_KEY: isLive ? requireLiveApiKey() : "offline",
  BROWSER_ALLOWED_ORIGINS: process.env.BROWSER_ALLOWED_ORIGINS ?? (isLive ? "https://example.org" : "https://docs.example.com"),
});

// the application lists its browser factory when it loads: the variables above come first
const { BrowserBotBypassApplication } = await import("./browser-bot-bypass.application.js");
const { StealthBrowser } = await import("./browser/stealth-browser.service.js");
const { BrowserFactory } = await import("./browser/browser-factory.js");
const { FakeBrowserFactory } = await import("./fake/fake-browser.factory.js");
const { AskWorkflowStart } = await import("./workflows/stealth/ask.workflow-start.js");
const { McpAskWorkflowStart } = await import("./workflows/mcp-stealth/mcp-ask.workflow-start.js");

function check(condition: boolean, what: string): void {
  if (!condition && !isLive) throw new Error(`demo check failed: ${what}`);
}
const answerOf = (result: ExecutionOutput): string => (result.output as { text: string }).text;

const openRouter = createOfflineOpenRouter();
const served = isLive ? undefined : await serveFetch(openRouter.fetch);
if (served !== undefined) process.env.OPENROUTER_BASE_URL = served.baseUrl;
const app = await createApp(BrowserBotBypassApplication, { env: isLive ? "dev" : "offline" });
const browser = app.resolve(StealthBrowser);
const fake = app.resolve(BrowserFactory);
const site = process.env.BROWSER_ALLOWED_ORIGINS?.split(";")[0] ?? "https://example.org";
// offline, the fake web has a pricing page; live, a real site: its front page
const pageUrl = isLive ? `${site}/` : `${site}/pricing`;
const question = isLive ? "tell me in one sentence what the page says" : "tell me the Starter price";

try {
  console.log(`browser-bot-bypass demo — ${isLive ? "live (OpenRouter, real Chrome)" : "offline ($0, a fake browser)"}; allowed: ${site}\n`);

  const viaTool = await app.execute(AskWorkflowStart, { text: `Open ${pageUrl} and ${question}.` });
  console.log(`Way A, open-page-stealth-tool (@Tool, the browser injected)\n  agent: ${answerOf(viaTool)}`);
  check(answerOf(viaTool).includes("12 USD"), "way A read the Starter price from the page");

  const refused = await app.execute(AskWorkflowStart, { text: "Open http://127.0.0.1:8080/admin and read it." });
  console.log(`Way A, 127.0.0.1 is not an allowed site\n  agent: ${answerOf(refused)}`);
  check(answerOf(refused).includes("not an allowed site"), "the loopback was refused");

  const viaMcp = await app.execute(McpAskWorkflowStart, { text: `Open ${pageUrl} and ${question}.` });
  console.log(`Way B, open-page-stealth-mcp-tool (the example's own MCP server)\n  agent: ${answerOf(viaMcp)}`);
  check(answerOf(viaMcp).includes("12 USD"), "way B read the Starter price through the MCP server");

  if (fake instanceof FakeBrowserFactory) {
    const { record } = fake;
    console.log(`\nthe fake browser: ${String(record.launches.length)} launch, ${String(record.contextsOpened)} contexts opened and ${String(record.contextsClosed)} closed`);
    console.log(`  launched with: ${record.launches[0]?.launchArgs.join(" ") ?? ""}`);
    check(record.launches.length === 1, "one browser for every call of way A");
    check(record.contextsOpened === record.contextsClosed, "every call's context is closed");
    check(record.navigations.every((navigation) => navigation.allowed), "the browser opened only allowed URLs");
  }
  const spend = [viaTool, refused, viaMcp].reduce((sum, run) => sum + run.spend.totalUsd, 0);
  console.log(`spend: $${spend.toFixed(6)}`);
} finally {
  await app.close();
  console.log(`browser still open after app.close(): ${String(await browser.handle.isOpen)}`);
  check(!(await browser.handle.isOpen), "the shared browser is closed when the application stops");
  await served?.close();
  restoreEnv();
}
if (!isLive) console.log("\nAll checks passed.");
