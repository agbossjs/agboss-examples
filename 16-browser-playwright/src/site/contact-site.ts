/**
 * The local test site: a tiny HTML site on 127.0.0.1 that the demo and the tests browse — no
 * internet. Fictional ("Acme Desk"), with the three things the examples need: pages to read, a
 * contact form whose POST is the side effect (a ticket, deduplicated by the form's `reference`, as
 * a payment API deduplicates by idempotency key), and a lookup of tickets by reference (what
 * `reconcile` asks after a lost answer).
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/** A ticket the form created. */
export interface Ticket {
  readonly id: string;
  readonly reference: string;
  readonly name: string;
  readonly email: string;
  readonly message: string;
}

/** What the next form POST does after the ticket is created: the failures an unreliable network brings. */
export enum SiteFault {
  /**
   * The ticket is created and a proxy in front of the site answers 502: the browser shows an error
   * page, the client cannot tell whether the ticket was filed (an unknown outcome). A cut connection
   * would do too, but Chromium re-sends a POST that a reused connection lost — itself a reason for the
   * reference — so the 502 is the fault that reaches `reconcile`.
   */
  BadGatewayAfterProcessing = "bad-gateway-after-processing",
  /** The ticket is created, the answer is held until `release()`. */
  HoldAnswer = "hold-answer",
}

/** The page the model reads: a fixed text, so a test knows what the page says. */
export const PRICING_TEXT = "Acme Desk pricing: Starter 12 USD per agent per month, Team 29 USD per agent per month.";

/** A page with a card number on it: the PII policy must keep it from the model. */
export const BILLING_TEXT = "Card on file: 4111 1111 1111 1111, renews on the 1st.";

const page = (title: string, body: string): string =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`;

const escaped = (value: string): string =>
  value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");

async function bodyOf(request: IncomingMessage): Promise<URLSearchParams> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

/** The site: `start()` listens on a free port of 127.0.0.1; its records are what the tests read. */
export class ContactSite {
  readonly tickets: Ticket[] = [];
  /** Every request the site received: `METHOD path`. A refused navigation never appears here. */
  readonly requests: string[] = [];
  private server: Server | undefined;
  private readonly faults: SiteFault[] = [];
  private readonly held: { readonly response: ServerResponse; readonly reference: string }[] = [];
  private readonly hung: ServerResponse[] = [];
  private port = 0;

  /** The address of the site on the loopback: what a server-side lookup calls. */
  get loopbackUrl(): string {
    return `http://127.0.0.1:${String(this.port)}`;
  }

  /** The next form POST creates its ticket and then fails like this. */
  inject(fault: SiteFault): void {
    this.faults.push(fault);
  }

  /** How many answers wait for `release()`. */
  get heldCount(): number {
    return this.held.length;
  }

  /** Answers every held request (the late answer a frozen process never reads). */
  release(): void {
    for (const { response, reference } of this.held.splice(0)) this.sendThanks(response, reference);
  }

  async start(): Promise<string> {
    this.server = createServer((request, response) => {
      void this.handle(request, response).catch(() => {
        response.destroy();
      });
    });
    await new Promise<void>((resolve) => this.server?.listen(0, "127.0.0.1", resolve));
    this.port = (this.server.address() as AddressInfo).port;
    return this.loopbackUrl;
  }

  async stop(): Promise<void> {
    this.release();
    this.server?.closeAllConnections();
    await new Promise<void>((resolve) => this.server?.close(() => { resolve(); }));
  }

  private async handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", this.loopbackUrl);
    this.requests.push(`${request.method ?? "GET"} ${url.pathname}`);
    if (request.method === "POST" && url.pathname === "/contact") {
      await this.submit(request, response);
      return;
    }
    const answer = this.pageAt(url);
    if (answer === undefined) response.writeHead(404, { "content-type": "text/plain" }).end("not found");
    else answer(response);
  }

  /** The page or the answer at a path, or undefined for a path the site does not have. */
  private pageAt(url: URL): ((response: ServerResponse) => void) | undefined {
    const html = (body: string) => (response: ServerResponse) => {
      this.send(response, body);
    };
    const redirectTo = (location: string) => (response: ServerResponse) => {
      this.redirect(response, location);
    };
    switch (url.pathname) {
      case "/":
        return html(page("Acme Desk", '<h1>Acme Desk</h1><a href="/pricing">Pricing</a> <a href="/contact">Contact us</a>'));
      case "/pricing":
        return html(page("Pricing", `<h1>Pricing</h1><p>${PRICING_TEXT}</p>`));
      case "/billing":
        return html(page("Billing", `<h1>Billing</h1><p>${BILLING_TEXT}</p>`));
      case "/contact":
        return html(this.formPage());
      case "/api/tickets":
        return (response) => {
          this.lookup(url, response);
        };
      // a listed page that sends the browser elsewhere: the allowlist must refuse the hop
      case "/go/loopback":
        return redirectTo(`${this.loopbackUrl}/secret`);
      // a page that navigates itself, by meta refresh and by script, to the loopback: the browser asks anew
      case "/meta":
        return html(`<!doctype html><meta http-equiv="refresh" content="0;url=${this.loopbackUrl}/secret"><p>moving</p>`);
      case "/js":
        return html(`<!doctype html><script>location = ${JSON.stringify(`${this.loopbackUrl}/secret`)};</script><p>moving</p>`);
      // a chain: the first hop is a listed page, the second goes to the loopback; and a redirect to a listed page
      case "/go/chain":
        return redirectTo(`${this.loopbackUrl.replace("127.0.0.1", "shop.test")}/go/loopback`);
      case "/go/pricing":
        return redirectTo("/pricing");
      case "/go/metadata":
        return redirectTo("http://169.254.169.254/latest/meta-data/");
      // a page that never answers: what a timeout and a cancelled run are tested against
      case "/slow":
        return (response) => {
          this.hung.push(response);
        };
      case "/secret":
        return html(page("Secret", "<p>internal-only: the admin console</p>"));
      default:
        return undefined;
    }
  }

  private formPage(): string {
    return page(
      "Contact us",
      `<h1>Contact us</h1><form method="post" action="/contact">
<label>Name <input name="name"></label>
<label>Email <input name="email" type="email"></label>
<label>Message <textarea name="message"></textarea></label>
<input type="hidden" name="reference" value="">
<button type="submit">Send</button></form>`,
    );
  }

  private async submit(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const form = await bodyOf(request);
    const reference = form.get("reference") ?? "";
    // one ticket per reference, however often the form is posted: the answer of the first is replayed
    const known = this.tickets.find((ticket) => ticket.reference === reference);
    if (known === undefined && reference !== "") {
      this.tickets.push({
        id: `T-${String(this.tickets.length + 1)}`,
        reference,
        name: form.get("name") ?? "",
        email: form.get("email") ?? "",
        message: form.get("message") ?? "",
      });
    }
    const fault = this.faults.shift();
    if (fault === SiteFault.BadGatewayAfterProcessing) {
      response.writeHead(502, { "content-type": "text/html" }).end(page("Bad gateway", "<h1>502 Bad Gateway</h1>"));
      return;
    }
    if (fault === SiteFault.HoldAnswer) {
      this.held.push({ response, reference });
      return;
    }
    this.sendThanks(response, reference);
  }

  private sendThanks(response: ServerResponse, reference: string): void {
    const ticket = this.tickets.find((each) => each.reference === reference);
    this.send(response, page("Thanks", `<p id="ticket">Ticket ${escaped(ticket?.id ?? "none")} recorded. We will answer by email.</p>`));
  }

  private lookup(url: URL, response: ServerResponse): void {
    const ticket = this.tickets.find((each) => each.reference === url.searchParams.get("reference"));
    if (ticket === undefined) response.writeHead(404, { "content-type": "application/json" }).end('{"error":"no such ticket"}');
    else response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(ticket));
  }

  private redirect(response: ServerResponse, location: string): void {
    response.writeHead(302, { location }).end();
  }

  private send(response: ServerResponse, html: string): void {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
  }
}
