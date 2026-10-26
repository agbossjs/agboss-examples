import { ExecutionStatus } from "@agboss/core";
import {
  callTool,
  replyWith,
  routeTo,
  testWith,
} from "@agboss/core/testing";
import { describe, expect, it } from "vitest";
import {
  LEGACY_STATE_FIELD_NAMES,
  runLegacySupportGraph,
} from "../../../../before-langgraph/support.graph.js";
import { IssueRefundAction } from "../../../src/actions/issue-refund.action.js";
import { OrderResearcherAgent } from "../../../src/agents/order-researcher/order-researcher.agent.js";
import { RefundSignOffAgent } from "../../../src/agents/refund-sign-off/refund-sign-off.agent.js";
import { ReplyEditorAgent } from "../../../src/agents/reply-editor/reply-editor.agent.js";
import { ReplyReviewerAgent } from "../../../src/agents/reply-reviewer/reply-reviewer.agent.js";
import { ReplyWriterAgent } from "../../../src/agents/reply-writer/reply-writer.agent.js";
import { ResearchPlannerAgent } from "../../../src/agents/research-planner/research-planner.agent.js";
import { ChangesRequestedDto } from "../../../src/dto/changes-requested.dto.js";
import { RefundIssuedDto } from "../../../src/dto/refund-issued.dto.js";
import { ReplyApprovedDto } from "../../../src/dto/reply-approved.dto.js";
import { ReplyDraftDto } from "../../../src/dto/reply-draft.dto.js";
import { ResearchFindingDto } from "../../../src/dto/research-finding.dto.js";
import { ResearchQuestionDto } from "../../../src/dto/research-question.dto.js";
import { SupportRequestDto } from "../../../src/dto/support-request.dto.js";
import { RefundSizeRouter } from "../../../src/routers/refund-size/refund-size.router.js";
import { SupportTriageRouter } from "../../../src/routers/support-triage/support-triage.router.js";
import { SupportApplication } from "../../../src/support.application.js";
import { IssueSignedOffRefundTool } from "../../../src/tools/issue-signed-off-refund.tool.js";
import { OrderLookupTool } from "../../../src/tools/order-lookup.tool.js";
import { HandOverWorkflowFinish } from "../../../src/workflows/support/hand-over.workflow-finish.js";
import { RefundIssuedWorkflowFinish } from "../../../src/workflows/support/refund-issued.workflow-finish.js";
import { ReplyStuckWorkflowFinish } from "../../../src/workflows/support/reply-stuck.workflow-finish.js";
import { SupportWorkflowStart } from "../../../src/workflows/support/support.workflow-start.js";

const test = testWith(SupportApplication);

const MIGRATION_ACCEPTANCE_REQUEST: SupportRequestDto = {
  orderId: "7",
  customerId: "CUST-1",
  customerEmail: "alice.synth@example.com",
  message: "My order came late, refund it please",
};

describe("07-langgraph-migration — Before (LangGraph God State) vs After (AGBossSupportWorkflow)", () => {
  it("reproduces the 15-field God State anti-patterns in before-langgraph/support.graph.ts", async () => {
    expect(LEGACY_STATE_FIELD_NAMES.length).toBe(15);

    const legacyTrace = await runLegacySupportGraph({
      orderId: "7",
      customerId: "CUST-1",
      customerEmail: "alice.synth@example.com",
      message: "My order came late, refund it please",
      requestedRefundCents: 2_500,
    });

    expect(legacyTrace.firstWritePromptSawUndefinedDraft).toBe(true);
    expect(legacyTrace.readonlyfirstWritePromptSawUndefinedCritique).toBe(true);
    expect(legacyTrace.unusedFieldPersistedInState).toBe(true);
  });

  test("small refund: one round of review changes (ReplyWriterAgent -> ReplyReviewerAgent -> ReplyEditorAgent -> ReplyReviewerAgent), then issued via IssueRefundAction", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(SupportTriageRouter).thenReturn(routeTo(ResearchPlannerAgent));
    mockLlm(ResearchPlannerAgent).thenReturn(
      replyWith(ResearchQuestionDto, [{ question: "Was it late?" }]),
    );
    mockLlm(OrderResearcherAgent).thenReturn(
      callTool(OrderLookupTool, { orderId: "7" }),
      replyWith(ResearchFindingDto, {
        question: "Was it late?",
        answer: "yes, by four days",
      }),
    );
    mockLlm(ReplyWriterAgent).thenReturn(
      replyWith(ReplyDraftDto, {
        text: "Sorry — refund on its way.",
        refundCents: 2_500,
      }),
    );
    mockLlm(ReplyReviewerAgent).thenReturn(
      replyWith(ChangesRequestedDto, { notes: "say how many days late" }),
      replyWith(ReplyApprovedDto, {}),
    );
    mockLlm(ReplyEditorAgent).thenReturn(
      replyWith(ReplyDraftDto, {
        text: "Four days late — sorry, refund on its way.",
        refundCents: 2_500,
      }),
    );

    const result = await app.execute(
      SupportWorkflowStart,
      MIGRATION_ACCEPTANCE_REQUEST,
    );

    expect(result).toFollowPath([
      SupportWorkflowStart,
      SupportTriageRouter,
      ResearchPlannerAgent,
      OrderResearcherAgent,
      ReplyWriterAgent,
      ReplyReviewerAgent,
      ReplyEditorAgent,
      ReplyReviewerAgent,
      RefundSizeRouter,
      IssueRefundAction,
      RefundIssuedWorkflowFinish,
    ]);
  });

  test("large refund: pauses for supervisor sign-off on RefundSignOffChannel and issues refund after app.resume", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(SupportTriageRouter).thenReturn(routeTo(ResearchPlannerAgent));
    mockLlm(ResearchPlannerAgent).thenReturn(
      replyWith(ResearchQuestionDto, [{ question: "Was it late?" }]),
    );
    mockLlm(OrderResearcherAgent).thenReturn(
      replyWith(ResearchFindingDto, {
        question: "Was it late?",
        answer: "yes, by four days",
      }),
    );
    mockLlm(ReplyWriterAgent).thenReturn(
      replyWith(ReplyDraftDto, {
        text: "Full refund.",
        refundCents: 25_000,
      }),
    );
    mockLlm(ReplyReviewerAgent).thenReturn(replyWith(ReplyApprovedDto, {}));
    mockLlm(RefundSignOffAgent).thenReturn(
      callTool(IssueSignedOffRefundTool, { orderId: "7", amountCents: 25_000 }),
      replyWith(RefundIssuedDto, { refundId: "refund-7" }),
    );

    const paused = await app.execute(
      SupportWorkflowStart,
      MIGRATION_ACCEPTANCE_REQUEST,
      { ownerId: "supervisor-1" },
    );

    expect(paused.status).toBe(ExecutionStatus.Paused);
    expect(paused).toHavePausedAt(RefundSignOffAgent);

    const pauseId: string = paused.pending[0]?.pauseId ?? "";
    const result = await app.resume(
      { pauseId, decision: { approved: true } },
      { ownerId: "supervisor-1" },
    );

    expect(result).toFinishWith(RefundIssuedWorkflowFinish, {
      refundId: "refund-7",
    });
  });

  test("review loop exceeding maxVisits exits cleanly via VisitsLimitExceededError to ReplyStuckWorkflowFinish", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(SupportTriageRouter).thenReturn(routeTo(ResearchPlannerAgent));
    mockLlm(ResearchPlannerAgent).thenReturn(
      replyWith(ResearchQuestionDto, [{ question: "Was it late?" }]),
    );
    mockLlm(OrderResearcherAgent).thenReturn(
      replyWith(ResearchFindingDto, {
        question: "Was it late?",
        answer: "yes, by four days",
      }),
    );
    mockLlm(ReplyWriterAgent).thenReturn(
      replyWith(ReplyDraftDto, { text: "Draft 1", refundCents: 2_500 }),
    );
    mockLlm(ReplyReviewerAgent).thenReturn(
      replyWith(ChangesRequestedDto, { notes: "Change 1" }),
      replyWith(ChangesRequestedDto, { notes: "Change 2" }),
      replyWith(ChangesRequestedDto, { notes: "Change 3" }),
    );
    mockLlm(ReplyEditorAgent).thenReturn(
      replyWith(ReplyDraftDto, { text: "Draft 2", refundCents: 2_500 }),
      replyWith(ReplyDraftDto, { text: "Draft 3", refundCents: 2_500 }),
    );

    const result = await app.execute(
      SupportWorkflowStart,
      MIGRATION_ACCEPTANCE_REQUEST,
    );

    expect(result).toFinishWith(
      ReplyStuckWorkflowFinish,
      MIGRATION_ACCEPTANCE_REQUEST,
    );
  });

  test("non-refund inquiry routes directly to HandOverWorkflowFinish", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(SupportTriageRouter).thenReturn(routeTo(HandOverWorkflowFinish));

    const result = await app.execute(
      SupportWorkflowStart,
      MIGRATION_ACCEPTANCE_REQUEST,
    );

    expect(result).toFinishWith(
      HandOverWorkflowFinish,
      MIGRATION_ACCEPTANCE_REQUEST,
    );
  });
});
