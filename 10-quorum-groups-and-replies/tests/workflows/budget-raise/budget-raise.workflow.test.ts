import { Channel, ExecutionStatus, PauseRespondent, PausedExecutionRepository, PauseKind, PauseStatus, StepError, PauseError, LimitError, type ChannelOutcome } from "@agboss/core";
import { testWith, type WorkflowFixtures } from "@agboss/core/testing";
import { describe, expect } from "vitest";
import { days } from "@agboss/core/units";
import { BudgetOwnerExternalTask } from "../../../src/channels/budget-owner.external-task.js";
import type { BudgetRaiseRequestDto } from "../../../src/dto/budget-raise-request.dto.js";
import { BudgetOwnerInbox } from "../../../src/services/budget-owner-inbox.service.js";
import { SupplierPurchaseApplication } from "../../../src/supplier-purchase.application.js";
import { BudgetRaiseRequestWorkflowStart } from "../../../src/workflows/budget-raise/budget-raise-request.workflow-start.js";
import { BudgetRaisedWorkflowFinish } from "../../../src/workflows/budget-raise/budget-raised.workflow-finish.js";
import { BudgetRaiseUnaskedWorkflowFinish } from "../../../src/workflows/budget-raise/budget-raise-unasked.workflow-finish.js";
import { BudgetRaiseUnresolvedWorkflowFinish } from "../../../src/workflows/budget-raise/budget-raise-unresolved.workflow-finish.js";

/**
 * An external task as a flow step (agbossjs/agboss#659): the budget raise asks its owner a typed
 * question, waits for a free-text reply read into a typed answer by code, asks again when the limit
 * is below the request — at most `maxVisits` times — and fails over to a finish of its own when the
 * channel cannot ask. No model: $0, offline.
 */

const test = testWith(SupplierPurchaseApplication);

/** A channel whose inbox is down: every `send` throws. */
@Channel({
  name: "down-budget-owner-channel",
  description: "A budget owners' channel whose inbox is down",
  target: BudgetOwnerExternalTask,
  ttl: days(1),
})
class DownBudgetOwnerChannel {
  send(): Promise<ChannelOutcome<BudgetOwnerExternalTask>> {
    return Promise.reject(new Error("budget owners' inbox unreachable"));
  }
}
const inboxDown = testWith(SupplierPurchaseApplication, {
  services: [DownBudgetOwnerChannel],
});

const RAISE: BudgetRaiseRequestDto = {
  budgetLine: "OPEX-IT-2026",
  amountUsd: 1_800,
  requester: "Ana Silva",
};
const OWNER = { actor: { id: "budget-owner-lee" } };

/**
 * The owners' inbox, replaced: what the channel posted — each ask with its pause id, the channel's
 * key, never in `result.pending`.
 */
function inboxOf(mockService: WorkflowFixtures["mockService"]) {
  const inbox = mockService(BudgetOwnerInbox);
  inbox.post.mockResolvedValue(undefined);
  const asked = () => inbox.post.mock.calls.map(([request]) => request);
  const newestPauseId = (): string => {
    const newest = asked().at(-1);
    if (newest === undefined) throw new Error("the budget owner was never asked");
    return newest.pauseId;
  };
  return { asked, newestPauseId };
}

describe("AC4: an external task asks the budget owner and puts the typed answer on the path", () => {
  test("the run pauses on the question: kind Question, its step, its ask; the owner asked once", async ({ app, mockService }) => {
    const { asked, newestPauseId } = inboxOf(mockService);
    const paused = await app.execute(BudgetRaiseRequestWorkflowStart, RAISE);

    expect(paused.status).toBe(ExecutionStatus.Paused);
    expect(paused.path).toEqual(["budget-raise-request-workflow-start", "budget-owner-external-task"]);
    expect(paused.pending).toHaveLength(1);
    const [pending] = paused.pending;
    if (pending?.kind !== PauseKind.ExternalTask) throw new Error("not paused on the question");
    expect(pending.step).toBe("budget-owner-external-task");
    expect(pending.pauseId).toBeUndefined(); // a Channel pause: only the channel has its id
    const ask: Readonly<Record<string, unknown>> = pending.input; // opaque: read as the role's ask
    expect(ask).toEqual({
      budgetLine: "OPEX-IT-2026",
      amountUsd: 1_800,
      requester: "Ana Silva",
    });
    const stored = await app
      .resolve(PausedExecutionRepository)
      .findByTenantIdAndPauseId("default", newestPauseId());
    expect(stored).toMatchObject({ kind: PauseKind.ExternalTask, step: "budget-owner-external-task", status: PauseStatus.Pending });
    expect(asked()).toHaveLength(1);
  });

  test("'up to $2,000' is read into the typed answer and the line is raised", async ({ app, mockService }) => {
    const { newestPauseId } = inboxOf(mockService);
    await app.execute(BudgetRaiseRequestWorkflowStart, RAISE);

    const done = await app.resume({ pauseId: newestPauseId(), reply: "ok, up to $2,000" }, { ...OWNER, includeRecord: true });

    expect(done).toFinishWith(BudgetRaisedWorkflowFinish, {
      budgetLine: "OPEX-IT-2026",
      amountUsd: 1_800,
      limitUsd: 2_000,
    });
    expect(done.record?.pauses).toMatchObject([
      { target: "budget-owner-external-task", respondent: PauseRespondent.Delegate, actor: { id: "budget-owner-lee" }, decision: { limitUsd: 2_000 } },
    ]);
  });

  test("an unreadable reply leaves the question pending; a readable one goes on", async ({ app, mockService }) => {
    const { newestPauseId } = inboxOf(mockService);
    await app.execute(BudgetRaiseRequestWorkflowStart, RAISE);
    const pauseId = newestPauseId();

    for (const reply of ["let me think", "up to $2k", "$2.000"])
      await expect(app.resume({ pauseId, reply }, OWNER)).rejects.toBeInstanceOf(PauseError.UninterpretableReply);
    const stored = await app.resolve(PausedExecutionRepository).findByTenantIdAndPauseId("default", pauseId);
    expect(stored?.status).toBe(PauseStatus.Pending);

    const done = await app.resume({ pauseId, reply: "exactly $1,800" }, OWNER);
    expect(done).toFinishWith(BudgetRaisedWorkflowFinish, { budgetLine: "OPEX-IT-2026", amountUsd: 1_800, limitUsd: 1_800 });
  });
});

describe("AC4 (failure injection): the owner never covers it, or cannot be asked", () => {
  test("maxVisits: asked twice below the request, the third ask is LimitError.Visits → unresolved", async ({ app, mockService }) => {
    const { asked, newestPauseId } = inboxOf(mockService);
    await app.execute(BudgetRaiseRequestWorkflowStart, RAISE);
    const again = await app.resume({ pauseId: newestPauseId(), reply: "up to $500" }, OWNER);
    expect(again.status).toBe(ExecutionStatus.Paused);
    expect(asked()).toHaveLength(2);

    const done = await app.resume({ pauseId: newestPauseId(), reply: "no" }, OWNER);

    expect(done).toFinishWith(BudgetRaiseUnresolvedWorkflowFinish);
    expect(done.output).toMatchObject({ budgetLine: "OPEX-IT-2026", amountUsd: 1_800 });
    expect(asked()).toHaveLength(2); // never asked a third time
    expect(done.handledErrors).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({ code: LimitError.Visits.code }) as unknown,
      }),
    ]);
  });

  inboxDown("a channel that throws is StepError.ExternalTask, taken by .onError → unasked", async ({ app }) => {
    const done = await app.execute(BudgetRaiseRequestWorkflowStart, RAISE);

    expect(done).toFinishWith(BudgetRaiseUnaskedWorkflowFinish);
    expect(done.pending).toEqual([]);
    expect(done.handledErrors).toEqual([
      expect.objectContaining({
        error: expect.objectContaining({
          code: StepError.ExternalTask.code,
          message: expect.stringContaining("inbox unreachable") as unknown,
          details: expect.objectContaining({ externalTask: "budget-owner-external-task" }) as unknown,
        }) as unknown,
      }),
    ]);
  });
});
