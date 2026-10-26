import { Injectable, type PiiMatch } from "@agboss/core";

@Injectable()
export class TicketPatternService {
  findTicketIds(text: string): readonly PiiMatch[] {
    return [...text.matchAll(/TCK-\d{6}/gu)].map((match) => ({
      start: match.index,
      end: match.index + match[0].length,
    }));
  }
}
