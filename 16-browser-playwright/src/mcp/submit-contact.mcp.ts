import { ExecutionContext, type ToolHandler } from "@agboss/core";
import { McpTool } from "@agboss/core/mcp";
import { seconds } from "@agboss/core/units";
import { ContactReceiptDto, ContactRequestDto } from "../dto/contact.dto.js";
import { ContactDesk, ticketIdOf } from "../services/contact-desk.service.js";
import { PlaywrightServer } from "./playwright.server.js";
import { PLAYWRIGHT_SESSION } from "./serial.js";

/**
 * The page script that fills the form and posts it from the page, and answers the site's status and
 * page: the values are data, JSON-quoted, never code. A post from the page is the form's own POST
 * (same origin, the page's cookies) and its answer comes back here, not in a navigation to wait for.
 */
const fillAndSubmit = (request: ContactRequestDto, reference: string): string =>
  `async () => { const form = document.forms[0]; const set = (name, value) => { form.elements[name].value = value; }; ` +
  `set("name", ${JSON.stringify(request.name)}); set("email", ${JSON.stringify(request.email)}); ` +
  `set("message", ${JSON.stringify(request.message)}); set("reference", ${JSON.stringify(reference)}); ` +
  `const answer = await fetch(form.action, { method: "POST", body: new URLSearchParams(new FormData(form)) }); ` +
  `return "status=" + answer.status + " " + (await answer.text()); }`;

/**
 * Way B: the same contact request through @playwright/mcp, in the same outbound call: a retry, a
 * second call or a takeover files one ticket. The form's address is the environment's, never the model's.
 */
@McpTool({
  server: PlaywrightServer,
  name: "submit-contact-mcp-tool",
  description:
    "Send a message to the support desk through its contact form. Use one reference per request; sending the same reference again files nothing new.",
  input: ContactRequestDto,
  output: ContactReceiptDto,
  timeout: seconds(60),
  deps: [ExecutionContext, PlaywrightServer, ContactDesk],
})
export class SubmitContactViaMcp implements ToolHandler<ContactRequestDto, ContactReceiptDto> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly server: PlaywrightServer,
    private readonly contactDesk: ContactDesk,
  ) {}

  run(request: ContactRequestDto): Promise<ContactReceiptDto> {
    return this.contactDesk.once(this.executionContext, request, (reference, signal) => PLAYWRIGHT_SESSION.run(async () => {
      await this.server.call("browser_navigate", { url: this.contactDesk.formUrl }, signal);
      const { text } = await this.server.call("browser_evaluate", { function: fillAndSubmit(request, reference) }, signal);
      const status = Number(/status=(\d+)/u.exec(text)?.[1]);
      // a proxy's 502 after the site filed the ticket is an unknown outcome: the next attempt reconciles
      if (status !== 200) throw new Error(`the site answered ${String(status)}: the ticket may or may not be filed`);
      return { ticketId: ticketIdOf(text) };
    }));
  }
}
