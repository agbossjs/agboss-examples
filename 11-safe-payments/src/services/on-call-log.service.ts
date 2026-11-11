import { Injectable } from "@agboss/core";

/**
 * Where the payment audit observer writes: an on-call log or an alerting client in production;
 * here, the line it would send. No state: the line is the return value.
 */
@Injectable()
export class OnCallLogService {
  write(line: string): string {
    return line;
  }
}
