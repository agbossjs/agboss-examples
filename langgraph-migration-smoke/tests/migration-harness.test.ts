import { ExecutionStatus } from "agboss";
import {
  callTool,
  replyWith,
  routeTo,
  testRouter,
  testWith,
} from "agboss/testing";
import { describe, expect, it } from "vitest";
import { MIGRATION_ACCEPTANCE_REQUEST } from "../expected/acceptance-tests/migration-acceptance.js";
import {
  EXPECTED_SKILL_REFERENCES,
  verifyPackagedCodingAgentSkills,
} from "../harness/create-clean-project.js";
import { measureMigrationBenchmark } from "../harness/measure-results.js";
import { SupportApplication } from "../src/application.js";
import {
  OrderResearcherAgent,
  RefundSignOffAgent,
  ReplyEditorAgent,
  ReplyReviewerAgent,
  ReplyWriterAgent,
  ResearchPlannerAgent,
} from "../src/support/support.agents.js";
import {
  ChangesRequestedDto,
  RefundIssuedDto,
  ReplyApprovedDto,
  ReplyDraftDto,
  ResearchFindingDto,
  ResearchQuestionDto,
} from "../src/support/support.dto.js";
import {
  HandOverWorkflowFinish,
  IssueRefundAction,
  RefundIssuedWorkflowFinish,
  RefundSizeRouter,
  ReplyStuckWorkflowFinish,
  SupportTriageRouter,
  SupportWorkflowStart,
} from "../src/support/support.nodes.js";
import {
  IssueSignedOffRefundTool,
  OrderLookupTool,
} from "../src/support/support.tools.js";

const test = testWith(SupportApplication);

describe("langgraph-migration-smoke — Coding-Agent Migration & Acceptance Proofs", () => {
  it("verifies all 13 coding-agent skill reference files (including 13-migrating-from-langgraph.md) and benchmark scorecard", async () => {
    const skills = await verifyPackagedCodingAgentSkills();
    expect(skills.skillEntryExists).toBe(true);
    expect(skills.referenceFilesFound).toEqual(EXPECTED_SKILL_REFERENCES);
    expect(skills.migrationGuidePresent).toBe(true);
    expect(skills.migrationGuideMentionsFourSteps).toBe(true);

    const scorecard = await measureMigrationBenchmark();
    expect(scorecard.legacyStateFieldsCount).toBe(15);
    expect(scorecard.legacyBugsReproduced).toEqual({
      firstWriteSawUndefinedDraft: true,
      firstWriteSawUndefinedCritique: true,
      unusedFieldPersisted: true,
    });
    expect(scorecard.skillsPackagedCount).toBe(13);
    expect(scorecard.narrowDtosCount).toBe(10);
    expect(scorecard.agbossCheckPassed).toBe(true);
    expect(scorecard.zeroLangGraphImportsInSrc).toBe(true);
  });

  test("small refund: one round of review changes, then issued immediately via IssueRefundAction", async ({
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

  it("RefundSizeRouter decides by code at $0 cost", async () => {
    const runRouter = testRouter(RefundSizeRouter);

    const { output } = await runRouter({
      draft: {
        producer: ReplyWriterAgent,
        value: { text: "Full refund.", refundCents: 25_000 },
      },
    });

    expect(output).toBe(RefundSignOffAgent);
  });
});
