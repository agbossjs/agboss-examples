import "../src/scripts/offline-keys.js";
import { createApp, ExecutionStatus, PauseClosedError, type PauseClosedReason, type App } from "@agboss/core";
import { seconds, type Milliseconds } from "@agboss/core/units";
import { setTimeout as sleep } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { afterWindow } from "../src/config/approval-window.js";
import { ApprovalInboxService } from "../src/services/approval-inbox.service.js";
import { OnCallLogService } from "../src/services/on-call-log.service.js";
import { resetRecordedToolOperations } from "../src/services/order-book.service.js";
import { SupportRefundDeskApplication } from "../src/support-refund-desk.application.js";
import { RefundApprovalWorkflowStart } from "../src/workflows/refund-approval/refund-approval.workflow-start.js";

export interface ApprovalEscalationResult {
  readonly pausedStatus: ExecutionStatus;
  /** Who was asked, in order. */
  readonly asked: readonly string[];
  /** The first approver's late answer: why it was refused. */
  readonly lateAnswerRefusedWith: PauseClosedReason | undefined;
  /** The finish's output: a `RefundApprovalOutcomeDto`. */
  readonly outcome: unknown;
  /** The on-call log: opened and closed, for each pause. */
  readonly onCallLog: readonly string[];
}

/** What the scenario needs of an application: an `App`, or a test's `TestApp`. */
export type ApprovalApp = Pick<App, "execute" | "resume" | "resolve">;

/** Lets the application's time pass: a test moves its virtual clock, the demo waits. */
export type PassTime = (duration: Milliseconds) => Promise<void>;

/**
 * Scenario E — nobody answers the first approver:
 * 1. A $1,450 refund is put to the on-call support lead (`refund-approver-external-task`, an answer
 *    within `APPROVAL_EXPIRES_IN`) and the run pauses.
 * 2. The deadline passes. The pause closes `expired`, the question step fails with
 *    `PauseExpiredError` and `.onError(PauseExpiredError, toExternalTask(SeniorRefundApproverExternalTask))`
 *    asks the head of support — a pause of its own.
 * 3. The first approver answers late: `PauseClosedError`, `reason: expired`.
 * 4. The head of support approves; the refund is issued once and the run finishes.
 * 5. The `refund-desk-pause-listener` wrote "opened" and "closed" for each of the two pauses.
 */
export async function driveApprovalEscalation(
  app: ApprovalApp,
  passTime: PassTime,
): Promise<ApprovalEscalationResult> {
  resetRecordedToolOperations();
  const paused = await app.execute(
    RefundApprovalWorkflowStart,
    {
      orderId: "ORD-1002",
      customerEmail: "alice.synth@example.com",
      amountUsd: 1_450,
      reason: "the workstation arrived broken",
    },
    { tenant: { tenantId: "acme", maxAutoRefundUsd: 500 }, execution: { locale: "en" } },
  );
  const inbox = app.resolve(ApprovalInboxService);
  const first = inbox.newest("approver");
  if (first === undefined) {
    throw new Error("the on-call support lead was never asked");
  }

  // the first approver's window passes; the expiry look runs on the pause timers' tick
  await passTime(afterWindow(seconds(6)));
  let senior = inbox.newest("senior-approver");
  for (let attempt = 0; senior === undefined && attempt < 60; attempt += 1) {
    await passTime(seconds(1));
    senior = inbox.newest("senior-approver");
  }
  if (senior === undefined) {
    throw new Error("the head of support was never asked");
  }

  let lateAnswerRefusedWith: PauseClosedReason | undefined;
  try {
    await app.resume(
      { pauseId: first.pauseId, decision: { approved: true, comment: "sorry, late" } },
      { tenantId: "acme", actor: { id: "lead-1" } },
    );
  } catch (error) {
    lateAnswerRefusedWith = error instanceof PauseClosedError ? error.reason : undefined;
  }

  const done = await app.resume(
    { pauseId: senior.pauseId, decision: { approved: true, comment: "approved by the head" } },
    { tenantId: "acme", actor: { id: "head-of-support" } },
  );

  // the listener is told after the run moved: let its notices land
  const log = app.resolve(OnCallLogService);
  for (let attempt = 0; log.lines().length < 4 && attempt < 60; attempt += 1) {
    await passTime(seconds(1));
  }

  return {
    pausedStatus: paused.status,
    asked: inbox.posted().map((entry) => entry.approver),
    lateAnswerRefusedWith,
    outcome: done.output,
    onCallLog: log.lines(),
  };
}

/** The demo: the application on the real clock — `APPROVAL_EXPIRES_IN=30s npm run demo:approval`. */
export async function runApprovalEscalationScenario(): Promise<ApprovalEscalationResult> {
  const app = await createApp(SupportRefundDeskApplication);
  try {
    // the application's timers do not keep the process alive: this wait does
    return await driveApprovalEscalation(app, (duration) => sleep(duration));
  } finally {
    await app.close();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runApprovalEscalationScenario();
  console.log(JSON.stringify(result, null, 2));
}
