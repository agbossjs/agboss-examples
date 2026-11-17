import { ContactSite } from "./contact-site.js";

/** The name the browser reaches the local site by: a resolver rule maps it to 127.0.0.1. */
export const SITE_HOST = "shop.test";

/** The local site started, and the environment variables that point the application at it. */
export interface RunningSite {
  readonly site: ContactSite;
  /** What the model may open: `http://shop.test:<port>`. */
  readonly origin: string;
  /** The variables the environments read and the MCP server's child inherits. */
  readonly variables: Readonly<Record<string, string>>;
}

/**
 * Starts the site on a free port and says how the application reaches it: the allowed origin is the
 * site's name (never 127.0.0.1 — that stays refused), mapped to the server for the browser,
 * the form is the model-proof fixed address, and `reconcile`'s lookup calls the loopback server-side.
 */
export async function startRunningSite(): Promise<RunningSite> {
  const site = new ContactSite();
  const loopback = await site.start();
  const port = new URL(loopback).port;
  const origin = `http://${SITE_HOST}:${port}`;
  return {
    site,
    origin,
    variables: {
      // the site's name, mapped to the loopback for the browser: 127.0.0.1 itself is not on the list
      BROWSER_ALLOWED_ORIGINS: `${origin}=127.0.0.1`,
      CONTACT_FORM_URL: `${origin}/contact`,
      CONTACT_LOOKUP_URL: loopback,
    },
  };
}
