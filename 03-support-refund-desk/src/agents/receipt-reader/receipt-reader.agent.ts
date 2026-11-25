import { Agent, FileView, ModelFiles, inline } from "@agboss/core";
import { kilobytes } from "@agboss/core/units";
import { ReceiptRefundRequestDto } from "../../dto/receipt-refund-request.dto.js";
import { CustomerContactPiiPolicy } from "../../pii-policies/customer-contact.pii-policy.js";
import { ReceiptPhotoPiiPolicy } from "../../pii-policies/receipt-photo.pii-policy.js";

/**
 * Reads the receipt a customer attached, on a redacted copy: the built-in image redactor (a cheap vision
 * model names the regions, `sharp` paints them black) hides what `ReceiptPhotoPiiPolicy` names before
 * the photo goes to this agent's model. The desk-wide policy is excluded: it blocks a card number, which
 * would conflict with blacking it out. Needs the optional peer dependency `sharp`; `maxFileSize` keeps a
 * redacted copy within what an execution holds without a file store.
 */
@Agent({
  name: "receipt-reader-agent",
  description: "Reads a receipt photo on a copy with the card number blacked out",
  prompt: inline("Say what the receipt shows: the store, the order and the total. One line."),
  model: "google/gemini-2.5-flash-lite",
  input: { request: ReceiptRefundRequestDto },
  piiPolicies: [ReceiptPhotoPiiPolicy],
  excludePiiPolicies: [CustomerContactPiiPolicy],
  files: ModelFiles.of({
    views: [FileView.Redacted],
    allowedMediaTypes: ["image/png", "image/jpeg"],
    maxFileSize: kilobytes(60),
  }),
})
export class ReceiptReaderAgent {}
