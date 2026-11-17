import { FakeBrowserFactory } from "../fake/fake-browser.factory.js";
import { BrowserFactory } from "./browser-factory.js";
import { ChromeBrowserFactory } from "./chrome-browser.factory.js";

/**
 * The factory the application lists: `BROWSER_FACTORY=fake` (tests, the offline demo, and the MCP
 * server's child when it is started by them) picks the fake; anything else, real Chrome.
 */
export const browserFactoryClass = (): new () => BrowserFactory =>
  process.env.BROWSER_FACTORY === "fake" ? FakeBrowserFactory : ChromeBrowserFactory;
