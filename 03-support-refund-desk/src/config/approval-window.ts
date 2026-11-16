import { hours, minutes, seconds } from "@agboss/core/units";
import type { Milliseconds } from "@agboss/core/units";

/**
 * How long each approver has to answer a refund approval: `APPROVAL_EXPIRES_IN` (`30s`, `15m`,
 * `4h`), else four hours. Read once, when the roles are declared — an open pause keeps the
 * deadline it was made with, so a deploy that changes it never moves a pause already asked.
 */
export function approvalWindowOf(text: string | undefined): Milliseconds {
  if (text === undefined || text === "") {
    return hours(4);
  }
  const match = /^(\d+)(s|m|h)$/u.exec(text);
  if (match === null) {
    throw new Error(`APPROVAL_EXPIRES_IN must look like 30s, 15m or 4h, got "${text}"`);
  }
  const amount = Number(match[1]);
  return match[2] === "s" ? seconds(amount) : match[2] === "m" ? minutes(amount) : hours(amount);
}

export const APPROVAL_WINDOW: Milliseconds = approvalWindowOf(process.env["APPROVAL_EXPIRES_IN"]);

/**
 * The lead is reminded when a quarter of the window is left (`remindBefore`): once per deadline,
 * whatever the number of instances, and again after an extension.
 */
export const APPROVAL_REMINDER: Milliseconds = seconds(APPROVAL_WINDOW / 4000);

/** The window plus `extra`, as a duration: how far a test or a demo moves time to pass the deadline. */
export const afterWindow = (extra: Milliseconds): Milliseconds =>
  (APPROVAL_WINDOW + extra) as Milliseconds;
