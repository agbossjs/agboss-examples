import { Injectable } from "@agboss/core";
import { launchStealthBrowser, newStealthContext } from "../vendor/stealth-browser.js";
import { BrowserFactory } from "./browser-factory.js";
import type { LaunchOptions, PortBrowser } from "./browser-port.js";

/**
 * Real Google Chrome, headed, through the vendored `createStealthBrowser` pieces over
 * rebrowser-playwright. Needs Chrome installed and a display (Xvfb on a server). CI never reaches it.
 */
@Injectable()
export class ChromeBrowserFactory extends BrowserFactory {
  async launch({ launchArgs }: LaunchOptions): Promise<PortBrowser> {
    const browser = await launchStealthBrowser({ headless: false, launchArgs });
    return {
      newContext: () => newStealthContext(browser),
      close: () => browser.close(),
      isConnected: () => browser.isConnected(),
    };
  }
}
