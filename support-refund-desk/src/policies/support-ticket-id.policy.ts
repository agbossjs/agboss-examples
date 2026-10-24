import {
  Injectable,
  PiiAction,
  PiiPolicy,
  type PiiMatch,
  type PiiPolicyHandler,
} from "agboss";

@Injectable()
export class TicketPatternService {
  findTicketIds(text: string): readonly PiiMatch[] {
    return [...text.matchAll(/TCK-\d{6}/gu)].map((match) => ({
      start: match.index,
      end: match.index + match[0].length,
    }));
  }
}

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
