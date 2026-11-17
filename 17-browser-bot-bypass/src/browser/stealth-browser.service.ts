import { ApplicationContext, Injectable, type OnDestroy } from "@agboss/core";
import { BrowserFactory } from "./browser-factory.js";
import { BrowserHandle } from "./browser-handle.js";
import { parseAllowlist } from "./origin-allowlist.js";

/**
 * The application's one browser, injected into the tool that needs it (`deps: [StealthBrowser]`) and
 * closed by `onDestroy` when `app.close()` has let the running executions finish — the core's
 * lifecycle hook for "a connection, a pool, a browser" (Wiki → App → Lifecycle hooks).
 */
@Injectable({ deps: [ApplicationContext, BrowserFactory] })
export class StealthBrowser implements OnDestroy {
  /** The handle: a resource the hooks own; the service itself keeps nothing. */
  readonly handle: BrowserHandle;
  /** The origins the browser may request. */
  readonly allowedOrigins: readonly string[];

  constructor(applicationContext: ApplicationContext, factory: BrowserFactory) {
    const environment = applicationContext.environment;
    const { origins, hostMap } = parseAllowlist(environment.browserAllowedOrigins);
    this.allowedOrigins = origins;
    this.handle = new BrowserHandle(factory, { allowedOrigins: origins, hostRules: hostMap });
  }

  /** `app.close()` → the running executions end → here: the browser is closed. */
  onDestroy(): Promise<void> {
    return this.handle.close();
  }
}
