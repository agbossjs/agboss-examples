import { Injectable } from "@agboss/core";
import { BrowserFactory } from "../browser/browser-factory.js";
import type { LaunchOptions, PortBrowser, PortContext, PortPage, PortRoute } from "../browser/browser-port.js";

/** The pages of the fake web: what a "real" site would answer. */
export const FAKE_WEB: Readonly<Record<string, { readonly title: string; readonly text: string }>> = {
  "https://docs.example.com/pricing": {
    title: "Pricing",
    text: "Acme Desk pricing: Starter 12 USD per agent per month, Team 29 USD per agent per month.",
  },
  "https://docs.example.com/": { title: "Acme Docs", text: "Acme Desk documentation. Pricing. Contact." },
};

/** A listed page that never answers: a call's timeout and a cancelled run are tested against it. */
export const SLOW_URL = "https://docs.example.com/slow";

/** What the fake saw: the tests read it instead of a Chrome's behaviour. */
export interface FakeRecord {
  /** The arguments each launch got. */
  readonly launches: LaunchOptions[];
  /** Contexts opened and closed, and the routes installed on them. */
  contextsOpened: number;
  contextsClosed: number;
  routes: number;
  /** Every URL a page tried to open and whether the context's route let it through. */
  readonly navigations: { readonly url: string; readonly allowed: boolean }[];
  closed: boolean;
}

/**
 * A browser that is not one: a scripted web (`FAKE_WEB`) behind the same narrow surface the real
 * Chrome satisfies. It runs the context's route handler on every navigation the way a browser does
 * — so the allowlist the application installs is exercised — and records what happened. Chrome is
 * never started: CI needs no Chrome and no display.
 */
@Injectable()
export class FakeBrowserFactory extends BrowserFactory {
  readonly record: FakeRecord = { launches: [], contextsOpened: 0, contextsClosed: 0, routes: 0, navigations: [], closed: false };
  /** The next launch fails with this (the browser could not start). */
  failLaunchWith: Error | undefined;

  launch(options: LaunchOptions): Promise<PortBrowser> {
    if (this.failLaunchWith !== undefined) return Promise.reject(this.failLaunchWith);
    this.record.launches.push(options);
    let connected = true;
    const record = this.record;
    return Promise.resolve({
      newContext: () => Promise.resolve(contextOf(record)),
      close: () => {
        connected = false;
        record.closed = true;
        return Promise.resolve();
      },
      isConnected: () => connected,
    });
  }
}

function contextOf(record: FakeRecord): PortContext {
  record.contextsOpened += 1;
  const handlers: ((route: PortRoute) => Promise<void>)[] = [];
  /** The navigations waiting for a page that never answers: closing the context ends them, as a browser's does. */
  const hung: ((error: Error) => void)[] = [];
  const closed = { done: false };
  return {
    route: (_pattern, handler) => {
      record.routes += 1;
      handlers.push(handler);
      return Promise.resolve();
    },
    newPage: () => Promise.resolve(pageOf(record, handlers, hung)),
    close: () => {
      // closing twice (the abort's and the call's own) is one close, as a browser's is
      if (!closed.done) record.contextsClosed += 1;
      closed.done = true;
      for (const end of hung.splice(0)) end(new Error("page.goto: Target page, context or browser has been closed"));
      return Promise.resolve();
    },
  };
}

function pageOf(record: FakeRecord, handlers: readonly ((route: PortRoute) => Promise<void>)[], hung: ((error: Error) => void)[]): PortPage {
  let current: { title: string; text: string } | undefined;
  return {
    goto: async (url) => {
      const verdict = { allowed: true };
      const route: PortRoute = {
        request: () => ({ url: () => url }),
        continue: () => Promise.resolve(),
        abort: () => {
          verdict.allowed = false;
          return Promise.resolve();
        },
      };
      for (const handler of handlers) await handler(route);
      record.navigations.push({ url, allowed: verdict.allowed });
      if (!verdict.allowed) throw new Error(`page.goto: net::ERR_BLOCKED_BY_CLIENT at ${url}`);
      if (url === SLOW_URL) return new Promise((_resolve, reject) => hung.push(reject));
      current = FAKE_WEB[url];
      if (current === undefined) throw new Error(`page.goto: net::ERR_NAME_NOT_RESOLVED at ${url}`);
      return {};
    },
    title: () => Promise.resolve(current?.title ?? ""),
    locator: () => ({ innerText: () => Promise.resolve(current?.text ?? "") }),
  };
}
