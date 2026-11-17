import type { BrowserFactory } from "./browser-factory.js";
import type { PortBrowser, PortContext } from "./browser-port.js";
import { isAllowedUrl, resolverRulesOf } from "./origin-allowlist.js";

/** How the shared browser is launched: the allowlist, a test site's name → address rule. */
export interface BrowserOptions {
  readonly allowedOrigins: readonly string[];
  /** A test site's rule (`MAP shop.test 127.0.0.1`); never set in a deployment. */
  readonly hostRules?: string | undefined;
  readonly onRefused?: ((url: string) => void) | undefined;
}

/**
 * One browser for the whole application, launched by the injected factory on the first page and
 * closed once, by the owner's `onDestroy`. A resource, not an execution's state: each call gets a
 * context of its own and closes it in a `finally`. A plain class on purpose (`agboss/no-component-state`
 * is about components that keep an execution's data; a connection is what `onInit` / `onDestroy` are for).
 */
export class BrowserHandle {
  private launched: Promise<PortBrowser> | undefined;
  private closed = false;
  /** How many browsers this handle launched: one, however many calls. */
  launches = 0;
  /** Contexts of calls in flight: zero when every call has ended, however it ended. */
  activeContexts = 0;

  constructor(
    private readonly factory: BrowserFactory,
    private readonly options: BrowserOptions,
  ) {}

  private browser(): Promise<PortBrowser> {
    if (this.closed) return Promise.reject(new Error("the browser is closed: the application is stopping"));
    if (this.launched === undefined) {
      this.launches += 1;
      const launching = this.factory.launch({
        launchArgs: [`--host-resolver-rules=${resolverRulesOf(this.options.allowedOrigins, this.options.hostRules)}`],
      });
      this.launched = launching;
      // a launch that failed (no Chrome, no display) is not kept: the next call launches again
      launching.catch(() => {
        if (this.launched === launching) this.launched = undefined;
      });
    }
    return this.launched;
  }

  /** A fresh context whose requests are limited to the listed origins. */
  private async guardedContext(): Promise<PortContext> {
    const context = await (await this.browser()).newContext();
    await context.route("**/*", async (route) => {
      const url = route.request().url();
      if (isAllowedUrl(url, this.options.allowedOrigins)) {
        await route.continue();
        return;
      }
      this.options.onRefused?.(url);
      await route.abort("blockedbyclient");
    });
    return context;
  }

  /**
   * One call's session: a context of its own, closed when the work ends, fails, or the call's signal
   * aborts (the tool's timeout, a cancelled run).
   */
  async use<TResult>(signal: AbortSignal, work: (context: PortContext) => Promise<TResult>): Promise<TResult> {
    signal.throwIfAborted();
    this.activeContexts += 1;
    const context = await this.guardedContext().catch((error: unknown) => {
      this.activeContexts -= 1;
      throw error;
    });
    const abort = (): void => {
      void context.close().catch(() => undefined);
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    try {
      return await work(context);
    } catch (error) {
      if (signal.aborted) throw signal.reason as Error;
      throw error;
    } finally {
      signal.removeEventListener("abort", abort);
      await context.close().catch(() => undefined);
      this.activeContexts -= 1;
    }
  }

  /** Closes the browser; safe to call twice. */
  async close(): Promise<void> {
    this.closed = true;
    if (this.launched !== undefined) await (await this.launched).close();
  }

  /** Whether a launched browser is still connected. */
  get isOpen(): Promise<boolean> {
    return this.launched === undefined ? Promise.resolve(false) : this.launched.then((browser) => browser.isConnected());
  }
}
