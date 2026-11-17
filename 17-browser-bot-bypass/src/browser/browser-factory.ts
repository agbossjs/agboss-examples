import type { LaunchOptions, PortBrowser } from "./browser-port.js";

/**
 * The role a launched browser comes from. The application lists one implementation —
 * `ChromeBrowserFactory` (real Chrome, headed), or the fake of `src/fake/` in tests and the offline
 * demo — and the shared browser asks for the role, never for a class. Swapping it is one line of
 * `providers` (or `override(BrowserFactory, …)` in a test).
 */
export abstract class BrowserFactory {
  abstract launch(options: LaunchOptions): Promise<PortBrowser>;
}
