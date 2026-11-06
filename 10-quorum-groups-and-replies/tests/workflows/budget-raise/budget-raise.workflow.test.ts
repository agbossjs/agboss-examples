import {
  ChannelOf,
  ExecutionStatus,
  PausedExecutionRepository,
  PauseKind,
  PauseStatus,
  QuestionFailedError,
  UninterpretableReplyError,
  VisitsLimitExceededError,
  type ChannelOutcome,
} from "@agboss/core";
import { override, testWith, type TestApp } from "@agboss/core/testing";
import { describe, expect } from "vitest";
import { BudgetOwnerQuestion } from "../../../src/channels/budget-owner-question.channel-role.js";
import type { BudgetRaiseRequestDto } from "../../../src/dto/budget-raise-request.dto.js";
import { BudgetOwnerInbox } from "../../../src/services/budget-owner-inbox.service.js";
import { SupplierPurchaseApplication } from "../../../src/supplier-purchase.application.js";
import { BudgetRaiseRequestWorkflowStart } from "../../../src/workflows/budget-raise/budget-raise-request.workflow-start.js";
import { BudgetRaisedWorkflowFinish } from "../../../src/workflows/budget-raise/budget-raised.workflow-finish.js";
import { BudgetRaiseUnaskedWorkflowFinish } from "../../../src/workflows/budget-raise/budget-raise-unasked.workflow-finish.js";
import { BudgetRaiseUnresolvedWorkflowFinish } from "../../../src/workflows/budget-raise/budget-raise-unresolved.workflow-finish.js";

/**
 * A question role as a flow step (agbossjs/agboss#659): the budget raise asks its owner a typed
 * question, waits for a free-text reply read into a typed answer by code, asks again when the limit
 * is below the request — at most `maxVisits` times — and fails over to a finish of its own when the
 * channel cannot ask. No model: $0, offline.
 */

const test = testWith(SupplierPurchaseApplication);

/** A channel whose inbox is down: every `send` throws. */
class DownBudgetOwnerChannel extends ChannelOf<BudgetOwnerQuestion> {
  send(): Promise<ChannelOutcome<BudgetOwnerQuestion>> {
    return Promise.reject(new Error("budget owners' inbox unreachable"));
  }
}
const inboxDown = testWith(SupplierPurchaseApplication, {
  overrides: [override(BudgetOwnerQuestion, DownBudgetOwnerChannel)],
});

const RAISE: BudgetRaiseRequestDto = {
  budgetLine: "OPEX-IT-2026",
  amountUsd: 1_800,
  requester: "Ana Silva",
};
const OWNER = { answeredBy: "budget-owner-lee" };

/** The pause id of the owner's newest question: the channel's key, never in `result.pending`. */
const newestPauseId = (app: TestApp): string => app.resolve(BudgetOwnerInbox).latestPauseId() ?? "";

describe("AC4: a question role asks the budget owner and puts the typed answer on the path", () => {
  test("the run pauses on the question: kind Question, its step, its ask; the owner asked once", async ({ app }) => {
    const paused = await app.execute(BudgetRaiseRequestWorkflowStart, RAISE);

    expect(paused.status).toBe(ExecutionStatus.Paused);
    expect(paused.path).toEqual(["budget-raise-request-workflow-start", "budget-owner-question"]);
    expect(paused.pending).toHaveLength(1);
    const [pending] = paused.pending;
    if (pending?.kind !== PauseKind.Question) throw new Error("not paused on the question");
    expect(pending.step).toBe("budget-owner-question");
    expect(pending.pauseId).toBeUndefined(); // a Channel pause: only the channel has its id
    const ask: Readonly<Record<string, unknown>> = pending.ask; // opaque: read as the role's ask
    expect(ask).toEqual({
      budgetLine: "OPEX-IT-2026",
      amountUsd: 1_800,
      requester: "Ana Silva",
    });
    const stored = await app
      .resolve(PausedExecutionRepository)
      .findByTenantIdAndPauseId("default", newestPauseId(app));
    expect(stored).toMatchObject({ kind: PauseKind.Question, step: "budget-owner-question", status: PauseStatus.Pending });
    expect(app.resolve(BudgetOwnerInbox).asked).toHaveLength(1);
  });

  test("'up to $2,000' is read into the typed answer and the line is raised", async ({ app }) => {
    await app.execute(BudgetRaiseRequestWorkflowStart, RAISE);

    const done = await app.resume({ pauseId: newestPauseId(app), reply: "ok, up to $2,000" }, { ...OWNER, record: true });

    expect(done).toFinishWith(BudgetRaisedWorkflowFinish, {
      budgetLine: "OPEX-IT-2026",
      amountUsd: 1_800,
      limitUsd: 2_000,
    });
    expect(done.record?.pauses).toMatchObject([
      { role: "budget-owner-question", responder: "budget-owner-lee", decision: { limitUsd: 2_000 } },
    ]);
  });

  test("an unreadable reply leaves the question pending; a readable one goes on", async ({ app }) => {
    await app.execute(BudgetRaiseRequestWorkflowStart, RAISE);
    const pauseId = newestPauseId(app);

    await expect(app.resume({ pauseId, reply: "let me think" }, OWNER)).rejects.toBeInstanceOf(
      UninterpretableReplyError,
    );
    const stored = await app.resolve(PausedExecutionRepository).findByTenantIdAndPauseId("default", pauseId);
    expect(stored?.status).toBe(PauseStatus.Pending);

    const done = await app.resume({ pauseId, decision: { limitUsd: 1_800 } }, OWNER);
    expect(done.finish?.name).toBe("budget-raised-workflow-finish");
  });
});

describe("AC4 (failure injection): the owner never covers it, or cannot be asked", () => {
  test("maxVisits: asked twice below the request, the third ask is VisitsLimitExceededError → unresolved", async ({ app }) => {
    await app.execute(BudgetRaiseRequestWorkflowStart, RAISE);
    const again = await app.resume({ pauseId: newestPauseId(app), reply: "up to $500" }, OWNER);
    expect(again.status).toBe(ExecutionStatus.Paused);
    expect(app.resolve(BudgetOwnerInbox).asked).toHaveLength(2);

    const done = await app.resume({ pauseId: newestPauseId(app), reply: "no" }, OWNER);

    expect(done).toFinishWith(BudgetRaiseUnresolvedWorkflowFinish);
    expect(done.output).toMatchObject({ budgetLine: "OPEX-IT-2026", amountUsd: 1_800 });
    expect(app.resolve(BudgetOwnerInbox).asked).toHaveLength(2); // never asked a third time
    expect(done.handledErrors).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({ code: VisitsLimitExceededError.code }) as unknown,
      }),
    ]);
  });

  inboxDown("a channel that throws is QuestionFailedError, taken by .onError → unasked", async ({ app }) => {
    const done = await app.execute(BudgetRaiseRequestWorkflowStart, RAISE);

    expect(done).toFinishWith(BudgetRaiseUnaskedWorkflowFinish);
    expect(done.pending).toEqual([]);
    expect(done.handledErrors).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({
          code: QuestionFailedError.code,
          message: expect.stringContaining("inbox unreachable") as unknown,
          details: expect.objectContaining({ question: "budget-owner-question" }) as unknown,
        }) as unknown,
      }),
    ]);
  });
});
