import {
  PiiAction,
  PiiGroup,
  PiiKind,
  PiiPolicy,
  pii,
  type PiiRefusal,
} from "@agboss/core";

@PiiPolicy({
  name: "customer-contact-pii-policy",
  description:
    "Tokenizes customer emails for tool roundtrips, redacts phone/postal contact fields, and blocks raw payment card numbers at the boundary.",
  rules: [
    pii(PiiGroup.Contact, PiiAction.replaceWithKind()),
    pii(PiiKind.Email, PiiAction.replaceWithToken()),
    pii(PiiKind.CardNumber, PiiAction.blockWithRefusal()),
  ],
})
export class CustomerContactPiiPolicy implements PiiRefusal {
  refusal(kind: PiiKind): string {
    return `Security policy block: please do not include raw ${kind} values in support messages.`;
  }
}
