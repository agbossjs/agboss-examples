import { Injectable } from "@agboss/core";

/** The on-call log: one line per pause event, written by the pause listener. */
@Injectable()
export class OnCallLogService {
  readonly #lines: string[] = [];

  write(line: string): void {
    this.#lines.push(line);
  }

  lines(): readonly string[] {
    return [...this.#lines];
  }
}
