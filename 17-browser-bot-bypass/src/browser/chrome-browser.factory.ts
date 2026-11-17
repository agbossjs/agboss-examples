import { Injectable } from "@agboss/core";
import { launchStealthBrowser, newStealthContext } from "../vendor/stealth-browser.js";
import { BrowserFactory } from "./browser-factory.js";
import type { LaunchOptions, PortBrowser, PortContext } from "./browser-port.js";

type StealthContext = Awaited<ReturnType<typeof newStealthContext>>;
type RealRoute = Parameters<Parameters<StealthContext["route"]>[1]>[0];
type RealResponse = Awaited<ReturnType<RealRoute["fetch"]>>;

/** The real context behind the narrow port: a route's `fulfill` takes the response its own `fetch` gave. */
const portOf = (context: StealthContext): PortContext => ({
  route: (pattern, handler) =>
    context.route(pattern, (route) =>
      handler({
        request: () => route.request(),
        fetch: (options) => route.fetch(options),
        fulfill: ({ response }) => route.fulfill({ response: response as RealResponse }),
        abort: (errorCode) => route.abort(errorCode),
      }),
    ),
  newPage: () => context.newPage(),
  close: () => context.close(),
});

/**
 * Real Google Chrome, headed, through the vendored `createStealthBrowser` pieces over
 * rebrowser-playwright. Needs Chrome installed and a display (Xvfb on a server). CI never reaches it.
 */
@Injectable()
export class ChromeBrowserFactory extends BrowserFactory {
  async launch({ launchArgs }: LaunchOptions): Promise<PortBrowser> {
    const browser = await launchStealthBrowser({ headless: false, launchArgs });
    return {
      newContext: async () => portOf(await newStealthContext(browser)),
      close: () => browser.close(),
      isConnected: () => browser.isConnected(),
    };
  }
}
