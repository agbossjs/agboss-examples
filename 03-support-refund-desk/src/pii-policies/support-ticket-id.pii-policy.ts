import {
  PiiAction,
  PiiPolicy,
  type PiiMatch,
  type PiiPolicyHandler,
} from "agboss";
import { TicketPatternService } from "../services/ticket-pattern.service.js";

@PiiPolicy({
  name: "support-ticket-id-pii-policy",
  action: PiiAction.replaceWithToken(),
  deps: [TicketPatternService],
})
export class SupportTicketIdPiiPolicy implements PiiPolicyHandler {
  constructor(private readonly ticketPatternService: TicketPatternService) {}

  findMatches(text: string): readonly PiiMatch[] {
    return this.ticketPatternService.findTicketIds(text);
  }
}
