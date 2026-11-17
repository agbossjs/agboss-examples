import {
  ApplicationContext,
  Injectable,
  NotSentTrust,
  OutboundCallReconciliation,
  OutboundCalls,
  effectKeyOf,
  type ExecutionContext,
} from "@agboss/core";
import { SharedBrowser } from "../browser/shared-browser.service.js";
import type { ContactReceiptDto, ContactRequestDto } from "../dto/contact.dto.js";

const TARGET = "acme-desk-contact-form";
const FORM_TIMEOUT_MS = 10_000;

/** What the site's lookup answers for a ticket: the part `reconcile` reads. */
interface TicketRow {
  readonly id: string;
}

/**
 * The one side effect of the examples: a contact form submitted in the browser creates a ticket on
 * a site that is not ours. A retry, a second tool call, a second execution or a takeover after a
 * crash must not file it twice, so it is not a bare click: it is an outbound call (an intent
 * recorded in a fenced write before the browser leaves, a lookup — `reconcile` — after an unknown
 * outcome), keyed by the request's own `reference` as a business key. The key that goes out is
 * `call.idempotencyKey`, put in the form's hidden `reference` field: the site files one ticket per
 * reference, as a payment API does per idempotency key (Wiki → Payments, Payment scenarios PS1, PS5).
 * Way A (the tool, the action) and Way B (the MCP tool) both send through this one function.
 */
@Injectable({ deps: [OutboundCalls, SharedBrowser, ApplicationContext] })
export class ContactDesk {
  constructor(
    private readonly outboundCalls: OutboundCalls,
    private readonly sharedBrowser: SharedBrowser,
    private readonly applicationContext: ApplicationContext,
  ) {}

  /** The form's address: from the environment, never from the model. */
  get formUrl(): string {
    return this.applicationContext.environment.contactFormUrl;
  }

  /** Way A: the shared browser fills the form and clicks "Send". */
  submit(executionContext: ExecutionContext, request: ContactRequestDto): Promise<ContactReceiptDto> {
    return this.once(executionContext, request, (reference) =>
      this.sharedBrowser.handle.use(executionContext.signal, async (context) => {
        const page = await context.newPage();
        await page.goto(this.formUrl, { timeout: FORM_TIMEOUT_MS, waitUntil: "load" });
        await page.fill("input[name=name]", request.name, { timeout: FORM_TIMEOUT_MS });
        await page.fill("input[name=email]", request.email, { timeout: FORM_TIMEOUT_MS });
        await page.fill("textarea[name=message]", request.message, { timeout: FORM_TIMEOUT_MS });
        // the hidden field carries the idempotency key: a string expression, the value JSON-quoted
        await page.evaluate(`document.querySelector("input[name=reference]").value = ${JSON.stringify(reference)}`);
        const [answer] = await Promise.all([
          page.waitForResponse((each) => each.request().method() === "POST", { timeout: FORM_TIMEOUT_MS }),
          page.click("button[type=submit]", { timeout: FORM_TIMEOUT_MS }),
        ]);
        // a proxy's 502 after the site filed the ticket is an unknown outcome, not a failure: the next
        // attempt reconciles — it must not read "no ticket" as "nothing was filed"
        if (!answer.ok()) throw new Error(`the site answered ${String(answer.status())}: the ticket may or may not be filed`);
        const body = await answer.text();
        return { ticketId: ticketIdOf(body.replace(/<[^>]*>/gu, " ")) };
      }),
    );
  }

  /**
   * The outbound call around one submit, however the browser is driven: `send` gets the idempotency
   * key to put in the form. Way B's MCP tool passes its own `send`.
   */
  async once(
    executionContext: ExecutionContext,
    request: ContactRequestDto,
    send: (reference: string, signal: AbortSignal) => Promise<ContactReceiptDto>,
  ): Promise<ContactReceiptDto> {
    // the request's reference, not the step: a second tool call, a second execution, a retry — one ticket
    const key = effectKeyOf(executionContext, "submit-contact", { businessKey: `contact:${request.reference}` });
    const { result } = await this.outboundCalls.send(key, {
      target: TARGET,
      operation: "submit-contact",
      // the fingerprint: the same reference with another message is a conflict, never a second ticket
      request: { reference: request.reference, name: request.name, email: request.email, message: request.message },
      send: (call) => send(call.idempotencyKey, call.signal),
      // asked only when an earlier attempt's outcome is unknown: look the ticket up, never click again blindly
      reconcile: async (lookup) => {
        const response = await fetch(
          `${this.applicationContext.environment.contactLookupUrl}/api/tickets?reference=${encodeURIComponent(lookup.idempotencyKey)}`,
          { signal: lookup.signal },
        );
        if (response.status === 404) return OutboundCallReconciliation.notSent();
        if (!response.ok) return OutboundCallReconciliation.unknown({ reason: `the lookup answered ${String(response.status)}` });
        const ticket = (await response.json()) as TicketRow;
        return OutboundCallReconciliation.completed({ ticketId: ticket.id });
      },
      // the site's own record by a reference that does not expire: its "no ticket" holds at any age
      notSent: { trust: NotSentTrust.Lookup },
    });
    return result;
  }
}

/** "Ticket T-1 recorded. …" → "T-1". */
export function ticketIdOf(text: string): string {
  const id = /Ticket (T-\d+)/u.exec(text)?.[1];
  if (id === undefined) throw new Error(`the site's answer names no ticket: ${text.slice(0, 80)}`);
  return id;
}
