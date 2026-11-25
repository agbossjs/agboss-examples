import { PiiFileAction, PiiKind, PiiPolicy } from "@agboss/core";

/**
 * What the receipt reader's model never sees as it is: a card number and an email are blacked out of
 * the photo (`FileView.Redacted`) before it goes to the model; an IBAN refuses the photo, the desk
 * refunds to the original card only.
 */
@PiiPolicy({
  name: "receipt-photo-pii-policy",
  description: "Black out card numbers and emails in a receipt photo; refuse an IBAN",
  rules: [
    PiiKind.CardNumber.mask(),
    PiiKind.Email.mask(),
    PiiKind.Iban.block("Please send the card receipt, not a bank statement."),
  ],
  // a block rule refuses an image whole by default: what a model says an image holds is a guardrail, not a
  // guarantee. This desk accepts that for receipts: the redaction model decides, an IBAN found refuses.
  files: PiiFileAction.RedactWithModel,
})
export class ReceiptPhotoPiiPolicy {}
