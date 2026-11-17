/**
 * The narrow surface of a browser this example uses — what the real Chrome (rebrowser-playwright's
 * objects satisfy it as they are) and the tests' fake both provide. The agent's tools, the shared
 * browser and the allowlist are written against these, so the wiring is tested with no Chrome.
 */

/** An answer fetched by a route: the part the allowlist reads. */
export interface PortResponse {
  status(): number;
  headers(): Record<string, string>;
}

/** A request a context's route sees. */
export interface PortRoute {
  request(): { url(): string; headers(): Record<string, string> };
  /** Fetches the request server-side; `maxRedirects: 0` hands a redirect back instead of following it. */
  fetch(options?: { url?: string; headers?: Record<string, string>; maxRedirects?: number }): Promise<PortResponse>;
  fulfill(options: { response: PortResponse }): Promise<void>;
  abort(errorCode?: string): Promise<void>;
}

/** A page: what the tools read. */
export interface PortPage {
  goto(url: string, options?: { timeout?: number; waitUntil?: "domcontentloaded" | "load" }): Promise<unknown>;
  title(): Promise<string>;
  locator(selector: string): { innerText(options?: { timeout?: number }): Promise<string> };
}

/** A context of one call: its pages and its network rule. */
export interface PortContext {
  route(url: string, handler: (route: PortRoute) => Promise<void>): Promise<unknown>;
  newPage(): Promise<PortPage>;
  close(): Promise<void>;
}

/** A launched browser: contexts of calls, one close. */
export interface PortBrowser {
  newContext(): Promise<PortContext>;
  close(): Promise<void>;
  isConnected(): boolean;
}

/** What the browser is launched with. */
export interface LaunchOptions {
  /** More browser arguments: the resolver rules of the allowlist. */
  readonly launchArgs: readonly string[];
}
