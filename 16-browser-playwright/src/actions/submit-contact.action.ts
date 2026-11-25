import {
  Action,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { ContactReceiptDto, ContactRequestDto } from "../dto/contact.dto.js";
import { ContactDesk } from "../services/contact-desk.service.js";

/**
 * The same submit as a step of a workflow, for a caller that already knows what to send (no model):
 * what the crash and takeover tests run, so a recovery re-runs this step on another instance.
 */
@Action({
  name: "submit-contact-action",
  description: "Files a request with the support desk through its contact form, once per reference",
  input: { request: ContactRequestDto },
  output: ContactReceiptDto,
  deps: [ContactDesk],
})
export class SubmitContactAction implements ActionHandler<SubmitContactAction> {
  constructor(private readonly contactDesk: ContactDesk) {}

  execute(input: InputOf<SubmitContactAction>): Promise<OutputOf<SubmitContactAction>> {
    return this.contactDesk.submit(input.request);
  }
}
