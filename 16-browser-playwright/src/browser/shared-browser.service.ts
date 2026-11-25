import { Injectable, type InferEnv, type OnDestroy } from "@agboss/core";
import { siteEnv } from "../site/site.env.js";
import { BrowserHandle } from "./browser-handle.js";
import { parseAllowlist } from "./origin-allowlist.js";

/**
 * The application's one browser, injected into the tools that need it (`deps: [SharedBrowser]`) and
 * closed by `onDestroy` when `app.close()` has let the running executions finish — the core's
 * lifecycle hook for "a connection, a pool, a browser" (Wiki → App → Lifecycle hooks). A tool never
 * launches or closes a browser.
 */
@Injectable({ deps: [siteEnv] })
export class SharedBrowser implements OnDestroy {
  /** The handle: a resource the hooks own; the service itself keeps nothing. */
  readonly handle: BrowserHandle;
  /** The origins the browser may request. */
  readonly allowedOrigins: readonly string[];

  constructor(site: InferEnv<typeof siteEnv>) {
    const { origins, hostMap } = parseAllowlist(site.allowedOrigins);
    this.allowedOrigins = origins;
    this.handle = new BrowserHandle({ allowedOrigins: origins, hostRules: hostMap });
  }

  /** `app.close()` → the running executions end → here: the browser process is closed. */
  onDestroy(): Promise<void> {
    return this.handle.close();
  }
}
