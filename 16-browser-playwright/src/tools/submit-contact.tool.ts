import { ExecutionContext, Tool, type ToolHandler } from "@agboss/core";
import { seconds } from "@agboss/core/units";
import { ContactReceiptDto, ContactRequestDto } from "../dto/contact.dto.js";
import { ContactDesk } from "../services/contact-desk.service.js";

/** Way A: files a request with the support desk through its contact form — once per reference. */
@Tool({
  name: "submit-contact-tool",
  description:
    "Send a message to the support desk through its contact form. Use one reference per request; sending the same reference again files nothing new.",
  input: ContactRequestDto,
  output: ContactReceiptDto,
  timeout: seconds(60),
  deps: [ExecutionContext, ContactDesk],
})
export class SubmitContact implements ToolHandler<ContactRequestDto, ContactReceiptDto> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly contactDesk: ContactDesk,
  ) {}

  run(request: ContactRequestDto): Promise<ContactReceiptDto> {
    return this.contactDesk.submit(this.executionContext, request);
  }
}
