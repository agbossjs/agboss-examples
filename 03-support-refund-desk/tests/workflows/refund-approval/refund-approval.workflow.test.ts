import {
  ExecutionStatus,
  PauseClosedError,
  PauseClosedReason,
  PausedExecutionRepository,
  PauseResolution,
} from "@agboss/core";
import { testWith } from "@agboss/core/testing";
import { seconds } from "@agboss/core/units";
import { describe, expect } from "vitest";
import { driveApprovalEscalation } from "../../../scenarios/approval-escalation.js";
import { afterWindow, APPROVAL_REMINDER, APPROVAL_WINDOW } from "../../../src/config/approval-window.js";
import { ApprovalInboxService } from "../../../src/services/approval-inbox.service.js";
import { OnCallLogService } from "../../../src/services/on-call-log.service.js";
import {
  getRecordedToolOperations,
  resetRecordedToolOperations,
} from "../../../src/services/order-book.service.js";
import { SupportRefundDeskApplication } from "../../../src/support-refund-desk.application.js";
import { RefundApprovalWorkflowFinish } from "../../../src/workflows/refund-approval/refund-approval.workflow-finish.js";
import { RefundApprovalWorkflowStart } from "../../../src/workflows/refund-approval/refund-approval.workflow-start.js";

/**
 * A refund above the self-service cap goes to the on-call support lead, who has `APPROVAL_EXPIRES_IN`
 * (four hours by default) to answer. Nobody answering is not a stuck run: the expiry escalates to the
 * head of support, and an `@PauseListener` logs every pause. The test's `clock` is virtual — hours
 * pass in milliseconds.
 */

process.env["OPENROUTER_API_KEY"] ??= "offline-test-openrouter-api-key";

const test = testWith(SupportRefundDeskApplication);

const ORDER = {
  orderId: "ORD-1002",
  customerEmail: "alice.synth@example.com",
  amountUsd: 1_450,
  reason: "the workstation arrived broken",
};
const CONTEXTS = { tenant: { tenantId: "acme", maxAutoRefundUsd: 500 }, execution: { locale: "en" } } as const;
const lead = { tenantId: "acme", answeredBy: "lead-1" };
const head = { tenantId: "acme", answeredBy: "head-of-support" };

/** Waits (on the virtual clock) until the pause timers' look has done what `done` checks. */
async function until(
  clock: { advance(duration: ReturnType<typeof seconds>): Promise<void> },
  done: () => boolean,
): Promise<void> {
  for (let attempt = 0; !done() && attempt < 60; attempt += 1) {
    await clock.advance(seconds(1));
  }
  expect(done()).toBe(true);
}

describe("AC2: a refund approval that expires escalates to the second approver", () => {
  test("the first approver answers in time: the refund is issued, no escalation", async ({ app, clock }) => {
    await app.ready();
    resetRecordedToolOperations();
    const paused = await app.execute(RefundApprovalWorkflowStart, ORDER, CONTEXTS);
    expect(paused.status).toBe(ExecutionStatus.Paused);
    const inbox = app.resolve(ApprovalInboxService);
    const first = inbox.newest("approver");
    if (first === undefined) throw new Error("the first approver was never asked");

    const done = await app.resume(
      { pauseId: first.pauseId, decision: { approved: true } },
      { ...lead, record: true },
    );

    expect(done).toFinishWith(RefundApprovalWorkflowFinish, {
      orderId: "ORD-1002",
      status: "refunded",
      decidedBy: "approver",
      refundId: expect.stringMatching(/^REF-ORD-1002-/u),
    });
    expect(inbox.posted().map((entry) => entry.approver)).toEqual(["approver"]);
    expect(getRecordedToolOperations().filter((entry) => entry.kind === "refund")).toHaveLength(1);

    // the deadline of an answered pause is no event: time passing changes nothing
    await clock.advance(afterWindow(seconds(30)));
    expect(inbox.posted()).toHaveLength(1);
  });

  test("the approval expires: the second approver is asked, approves, the refund is issued once", async ({ app, clock }) => {
    await app.ready();
    const result = await driveApprovalEscalation(app, (duration) => clock.advance(duration));

    expect(result.pausedStatus).toBe(ExecutionStatus.Paused);
    expect(result.asked).toEqual(["approver", "senior-approver"]);
    expect(result.outcome).toMatchObject({
      orderId: "ORD-1002",
      status: "refunded",
      decidedBy: "senior-approver",
    });
    expect(getRecordedToolOperations().filter((entry) => entry.kind === "refund")).toHaveLength(1);
  });

  test("the first approver's late answer is refused as expired and moves nothing", async ({ app, clock }) => {
    await app.ready();
    const result = await driveApprovalEscalation(app, (duration) => clock.advance(duration));

    expect(result.lateAnswerRefusedWith).toBe(PauseClosedReason.Expired);
  });

  test("the listener logged opened and closed for each pause, with the reason", async ({ app, clock }) => {
    await app.ready();
    const result = await driveApprovalEscalation(app, (duration) => clock.advance(duration));

    const log = result.onCallLog.map((line) => line.replace(/ [0-9a-f]{16,}/u, " <pause>"));
    expect(log).toHaveLength(4);
    expect(log.filter((line) => line.startsWith("opened refund-approver-question"))).toHaveLength(1);
    expect(log.filter((line) => line.startsWith("opened senior-refund-approver-question"))).toHaveLength(1);
    expect(log).toContain("closed refund-approver-question <pause>: expired");
    expect(log).toContain("closed senior-refund-approver-question <pause>: answered by head-of-support");
  });
});

describe("a deadline the person can move, a reminder before it, a default when nobody is left", () => {
  test("the lead is reminded once, before the deadline, and not escalated yet", async ({ app, clock }) => {
    await app.ready();
    const inbox = app.resolve(ApprovalInboxService);
    await app.execute(RefundApprovalWorkflowStart, ORDER, CONTEXTS);

    // a quarter of the window is left: the pause timers' look tells the channel
    await clock.advance(seconds((APPROVAL_WINDOW - APPROVAL_REMINDER) / 1000 + 6));
    await until(clock, () => inbox.notes().length === 1);
    await clock.advance(seconds(20));

    expect(inbox.notes()).toHaveLength(1);
    expect(inbox.notes()[0]).toContain("reminder: ORD-1002 expires at ");
    expect(inbox.posted().map((entry) => entry.approver)).toEqual(["approver"]);
  });

  test("the lead extends the deadline: no escalation at the old one, escalation at the new one", async ({ app, clock }) => {
    await app.ready();
    const inbox = app.resolve(ApprovalInboxService);
    await app.execute(RefundApprovalWorkflowStart, ORDER, CONTEXTS);
    const first = inbox.newest("approver");
    if (first === undefined) throw new Error("the first approver was never asked");

    await clock.advance(seconds(10));
    // to now + two windows: later than the deadline it has
    const extension = await app.extendPause(
      { pauseId: first.pauseId, expiresIn: afterWindow(APPROVAL_WINDOW) },
      lead,
    );
    expect(Date.parse(extension.expiresAt)).toBeGreaterThan(Date.parse(extension.previousExpiresAt));
    await until(clock, () => inbox.notes().some((line) => line.startsWith("extended: ORD-1002 until ")));

    await clock.advance(afterWindow(seconds(6))); // past the old deadline, before the new one
    expect(inbox.newest("senior-approver")).toBeUndefined();
    await clock.advance(afterWindow(seconds(6))); // past the new one
    await until(clock, () => inbox.newest("senior-approver") !== undefined);
    expect(inbox.posted().map((entry) => entry.approver)).toEqual(["approver", "senior-approver"]);
  });

  test("nobody answers either approver: the desk declines on the channel's own answer, no refund", async ({ app, clock }) => {
    await app.ready();
    resetRecordedToolOperations();
    const inbox = app.resolve(ApprovalInboxService);
    const log = app.resolve(OnCallLogService);
    const paused = await app.execute(RefundApprovalWorkflowStart, ORDER, CONTEXTS);

    await clock.advance(afterWindow(seconds(6))); // the lead's window passes
    await until(clock, () => inbox.newest("senior-approver") !== undefined);
    await clock.advance(afterWindow(seconds(6))); // and the head's
    await until(clock, () => log.lines().filter((line) => line.startsWith("closed")).length === 2);

    expect(getRecordedToolOperations().filter((entry) => entry.kind === "refund")).toHaveLength(0);
    const pauses = await app
      .resolve(PausedExecutionRepository)
      .findAllByTenantIdAndRootExecutionId("acme", paused.executionId);
    expect(pauses.map((pause) => pause.resolution)).toEqual([
      PauseResolution.Expired,
      PauseResolution.DecidedOnExpiry,
    ]);
    // the listener sees the pause's close — expired — for both; who decided is in the answer log
    expect(log.lines().filter((line) => line.endsWith(": expired"))).toHaveLength(2);
    // the head's pause is closed: a late answer is refused
    const senior = inbox.newest("senior-approver");
    if (senior === undefined) throw new Error("the senior approver was never asked");
    const refusal = await app.resume({ pauseId: senior.pauseId, decision: { approved: true } }, head).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(refusal).toBeInstanceOf(PauseClosedError);
  });
});
