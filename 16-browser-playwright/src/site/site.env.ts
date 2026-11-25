import { defineEnv, env } from "@agboss/core";
import { DEFAULT_ALLOWED_ORIGINS } from "../browser/origin-allowlist.js";

/**
 * Where the browser may go and where the contact form is — public addresses, no secrets. The defaults are
 * `example.org`: a first run of your own reaches nothing else. The demo and the tests point the variables at
 * the local site (`site-environment.ts`).
 */
export const siteEnv = defineEnv({
  /**
   * The origins the browser may request, semicolon-separated (`https://docs.example.com;https://example.org`).
   * Everything else is refused, redirects included — also by the MCP server's browser, which reads the same variable.
   */
  allowedOrigins: env("BROWSER_ALLOWED_ORIGINS", { default: DEFAULT_ALLOWED_ORIGINS }),
  /** The contact form the submit tool fills: fixed here, never chosen by the model. */
  contactFormUrl: env("CONTACT_FORM_URL", { default: "https://example.org/contact" }),
  /** Where `recovery` asks the site for a ticket by reference: a server-side call to a trusted address. */
  contactLookupUrl: env("CONTACT_LOOKUP_URL", { default: "https://example.org" }),
});
