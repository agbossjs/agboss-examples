import { PiiGroup, PiiKind, PiiPolicy, type PiiRefusal } from "@agboss/core";

@PiiPolicy({
  name: "customer-contact-pii-policy",
  description:
    "Tokenizes customer emails for tool roundtrips, redacts phone/postal contact fields, and blocks raw payment card numbers at the boundary.",
  rules: [
    PiiGroup.Contact.mask(),
    PiiKind.Email.tokenize(),
    PiiKind.CardNumber.block(),
  ],
})
export class CustomerContactPiiPolicy implements PiiRefusal {
  refusal(kind: PiiKind): string {
    return `Security policy block: please do not include raw ${kind.id} values in support messages.`;
  }
}
