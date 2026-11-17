import { chromium, type Browser, type BrowserContext } from "playwright";
import { guardContext, resolverRulesOf, type RefusedRequest } from "./origin-allowlist.js";

/** How the shared browser is launched: headless Chromium, the allowlist, a test's name → address map. */
export interface BrowserOptions {
  readonly allowedOrigins: readonly string[];
  /**
   * A test site's name → address rule (`MAP shop.test 127.0.0.1`): the name reaches the local server
   * while 127.0.0.1 itself stays refused by the allowlist. Never set in a deployment.
   */
  readonly hostRules?: string | undefined;
  readonly onRefused?: RefusedRequest | undefined;
}

/**
 * One headless Chromium for the whole application, started on the first page and closed once, by the
 * owner's `onDestroy`. It is a resource, not an execution's state: nothing of an execution lives in
 * it — each call gets its own context (cookies, storage, pages) and closes it in a `finally`.
 * A plain class on purpose: `agboss/no-component-state` is about components that keep an
 * execution's data; a connection is what `onInit` / `onDestroy` exist for.
 */
export class BrowserHandle {
  private launched: Promise<Browser> | undefined;
  private closed = false;
  /** How many Chromium processes this handle has started: one, however many calls. */
  launches = 0;
  /** Contexts of calls in flight: zero when every call has ended, however it ended. */
  activeContexts = 0;

  constructor(private readonly options: BrowserOptions) {}

  /** Launches on first use; two calls at once share one launch. */
  private browser(): Promise<Browser> {
    if (this.closed) return Promise.reject(new Error("the browser is closed: the application is stopping"));
    if (this.launched === undefined) {
      this.launches += 1;
      const launching = chromium.launch({
        headless: true,
        args: [`--host-resolver-rules=${resolverRulesOf(this.options.allowedOrigins, this.options.hostRules)}`],
      });
      this.launched = launching;
      // a launch that failed (browsers not installed) is not kept: the next call launches again
      launching.catch(() => {
        if (this.launched === launching) this.launched = undefined;
      });
    }
    return this.launched;
  }

  /** A fresh, guarded context: only the listed origins can be requested through it. */
  async openContext(): Promise<BrowserContext> {
    const context = await (await this.browser()).newContext({ viewport: { width: 1024, height: 768 } });
    await guardContext(context, this.options.allowedOrigins, this.options.onRefused);
    return context;
  }

  /**
   * One call's browser session: a context of its own, closed when the work ends, fails, or the
   * call's signal aborts (the tool's timeout, a cancelled run). An abort closes the context at once,
   * so a page waiting on a slow site stops waiting instead of outliving the call.
   */
  async use<TResult>(signal: AbortSignal, work: (context: BrowserContext) => Promise<TResult>): Promise<TResult> {
    signal.throwIfAborted();
    this.activeContexts += 1;
    const context = await this.openContext().catch((error: unknown) => {
      this.activeContexts -= 1;
      throw error;
    });
    const abort = (): void => {
      void context.close().catch(() => undefined);
    };
    signal.addEventListener("abort", abort, { once: true });
    // an abort that came while the context was being made fired before the listener existed
    if (signal.aborted) abort();
    try {
      return await work(context);
    } catch (error) {
      // a context closed by the abort fails the page's call with "Target closed": say why instead
      if (signal.aborted) throw signal.reason as Error;
      throw error;
    } finally {
      signal.removeEventListener("abort", abort);
      await context.close().catch(() => undefined);
      this.activeContexts -= 1;
    }
  }

  /** Closes the browser; the contexts of calls in flight end with it. Safe to call twice. */
  async close(): Promise<void> {
    this.closed = true;
    if (this.launched !== undefined) await (await this.launched).close();
  }

  /** Whether a launched browser process is still connected (a test asks after the app closes). */
  get isOpen(): Promise<boolean> {
    return this.launched === undefined ? Promise.resolve(false) : this.launched.then((browser) => browser.isConnected());
  }
}
