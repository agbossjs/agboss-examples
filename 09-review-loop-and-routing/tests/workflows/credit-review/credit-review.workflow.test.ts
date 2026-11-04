import { VisitsLimitExceededError } from "@agboss/core";
import { replyWith, routeTo, testWith } from "@agboss/core/testing";
import { usd } from "@agboss/core/units";
import { describe, expect } from "vitest";
import { EscalateToCommitteeAction } from "../../../src/actions/escalate-to-committee.action.js";
import { CreditAnalystAgent } from "../../../src/agents/credit-analyst/credit-analyst.agent.js";
import { MemoEditorAgent } from "../../../src/agents/memo-editor/memo-editor.agent.js";
import { RiskOfficerAgent } from "../../../src/agents/risk-officer/risk-officer.agent.js";
import { CreditReviewApplication } from "../../../src/credit-review.application.js";
import { CreditMemoDto } from "../../../src/dto/credit-memo.dto.js";
import { MemoApprovedDto } from "../../../src/dto/memo-approved.dto.js";
import { MemoChangesRequestedDto } from "../../../src/dto/memo-changes-requested.dto.js";
import { CreditIntentModelRouter } from "../../../src/routers/credit-intent-model/credit-intent-model.router.js";
import { CreditLimitCodeRouter } from "../../../src/routers/credit-limit-code/credit-limit-code.router.js";
import { CodeRoutedCreditWorkflowStart } from "../../../src/workflows/credit-review/code-routed-credit.workflow-start.js";
import { CreditApprovedWorkflowFinish } from "../../../src/workflows/credit-review/credit-approved.workflow-finish.js";
import { CreditDeclinedWorkflowFinish } from "../../../src/workflows/credit-review/credit-declined.workflow-finish.js";
import { CreditEscalatedWorkflowFinish } from "../../../src/workflows/credit-review/credit-escalated.workflow-finish.js";
import { ModelRoutedCreditWorkflowStart } from "../../../src/workflows/credit-review/model-routed-credit.workflow-start.js";
import { SOUND_APPLICATION, WEAK_APPLICATION } from "../../support/applications.js";

/**
 * The credit review on its application: every model by script (`mockLlm`), the network blocked.
 * The code router needs no script — it calls no model.
 */

const test = testWith(CreditReviewApplication);

const ROUTER_COST = usd(0.00004);
const memo = (text: string, recommendedLimitUsd = 35_000) =>
  replyWith(CreditMemoDto, { text, recommendedLimitUsd });
const changes = (notes: string) => replyWith(MemoChangesRequestedDto, { notes });
const approved = (note?: string) => replyWith(MemoApprovedDto, note === undefined ? {} : { note });

describe("AC2: the same application, routed by code and by a model", () => {
  test("AC2: both starts route the same application the same way; the code router's spend is $0", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(CreditIntentModelRouter).thenReturn(routeTo(CreditAnalystAgent, { cost: ROUTER_COST }));
    mockLlm(CreditAnalystAgent).thenReturn(memo("v1"), memo("v1"));
    mockLlm(RiskOfficerAgent).thenReturn(approved(), approved());

    const byCode = await app.execute(CodeRoutedCreditWorkflowStart, SOUND_APPLICATION, {
      record: true,
    });
    const byModel = await app.execute(ModelRoutedCreditWorkflowStart, SOUND_APPLICATION, {
      record: true,
    });

    expect(byCode).toFollowPath([
      CodeRoutedCreditWorkflowStart,
      CreditLimitCodeRouter,
      CreditAnalystAgent,
      RiskOfficerAgent,
      CreditApprovedWorkflowFinish,
    ]);
    expect(byModel).toFollowPath([
      ModelRoutedCreditWorkflowStart,
      CreditIntentModelRouter,
      CreditAnalystAgent,
      RiskOfficerAgent,
      CreditApprovedWorkflowFinish,
    ]);
    // the code router made no call: nothing under its name, no routing cost
    expect(byCode.spend.byCaller["router:credit-limit-code-router"]).toBeUndefined();
    expect(byCode.spend.byCategory.routing).toBe(0);
    const codeStep = byCode.record?.steps.find(
      (step) => step.step.component.name === "credit-limit-code-router",
    );
    expect(codeStep?.spend.calls).toBe(0);
    expect(codeStep?.spend.totalUsd).toBe(0);
    // the model router's decision is paid: the scripted cost, under its own caller
    expect(byModel.spend.byCaller["router:credit-intent-model-router"]).toBe(0.00004);
    expect(byModel.spend.byCategory.routing).toBe(0.00004);
  });

  test("AC2: a declined application stops at the declined finish on both starts — no agent runs", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(CreditIntentModelRouter).thenReturn(
      routeTo(CreditDeclinedWorkflowFinish, { cost: ROUTER_COST }),
    );

    const byCode = await app.execute(CodeRoutedCreditWorkflowStart, WEAK_APPLICATION);
    const byModel = await app.execute(ModelRoutedCreditWorkflowStart, WEAK_APPLICATION);

    expect(byCode).toFollowPath([
      CodeRoutedCreditWorkflowStart,
      CreditLimitCodeRouter,
      CreditDeclinedWorkflowFinish,
    ]);
    expect(byModel).toFollowPath([
      ModelRoutedCreditWorkflowStart,
      CreditIntentModelRouter,
      CreditDeclinedWorkflowFinish,
    ]);
    expect(byCode).toFinishWith(CreditDeclinedWorkflowFinish, WEAK_APPLICATION);
    expect(byModel).toFinishWith(CreditDeclinedWorkflowFinish, WEAK_APPLICATION);
    expect(byCode.spend.totalUsd).toBe(0);
    expect(byCode.spend.calls).toBe(0);
    expect(mockLlm(CreditAnalystAgent).requests).toHaveLength(0);
  });
});

describe("the review loop ends on a defined finish", () => {
  test("approved at once: the analyst's memo is the approved one, no editor", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(CreditAnalystAgent).thenReturn(memo("v1: Dana Levi, kitchen", 40_000));
    mockLlm(RiskOfficerAgent).thenReturn(approved("complete"));

    const result = await app.execute(CodeRoutedCreditWorkflowStart, SOUND_APPLICATION);

    expect(result).toFinishWith(CreditApprovedWorkflowFinish, {
      text: "v1: Dana Levi, kitchen",
      recommendedLimitUsd: 40_000,
    });
    expect(result.path).not.toContain("memo-editor-agent");
    expect(mockLlm(MemoEditorAgent).requests).toHaveLength(0);
  });

  test("approved after one round: changes → editor → approved, the rewrite is the approved memo", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(CreditAnalystAgent).thenReturn(memo("v1"));
    mockLlm(RiskOfficerAgent).thenReturn(changes("name the main risk"), approved());
    mockLlm(MemoEditorAgent).thenReturn(memo("v2: the main risk is the DTI"));

    const result = await app.execute(CodeRoutedCreditWorkflowStart, SOUND_APPLICATION);

    expect(result).toFollowPath([
      CodeRoutedCreditWorkflowStart,
      CreditLimitCodeRouter,
      CreditAnalystAgent,
      RiskOfficerAgent,
      MemoEditorAgent,
      RiskOfficerAgent,
      CreditApprovedWorkflowFinish,
    ]);
    expect(result).toFinishWith(CreditApprovedWorkflowFinish, {
      text: "v2: the main risk is the DTI",
      recommendedLimitUsd: 35_000,
    });
    // the editor reads the officer's notes and the memo they are about
    const [editorInput] = mockLlm(MemoEditorAgent).inputs;
    expect(editorInput?.changes).toMatchObject({ value: { notes: "name the main risk" } });
    expect(editorInput?.memo).toMatchObject({ current: { value: { text: "v1" } }, previous: [] });
    // the officer reads the newest memo each time
    const officerMemos = mockLlm(RiskOfficerAgent).inputs.map((input) => input.memo.value.text);
    expect(officerMemos).toEqual(["v1", "v2: the main risk is the DTI"]);
  });

  test("approved on the editor's last visit (visit 4): no escalation", async ({ app, mockLlm }) => {
    mockLlm(CreditAnalystAgent).thenReturn(memo("v1"));
    mockLlm(RiskOfficerAgent).thenReturn(
      changes("fix 1"),
      changes("fix 2"),
      changes("fix 3"),
      changes("fix 4"),
      approved("finally"),
    );
    mockLlm(MemoEditorAgent).thenReturn(memo("v2"), memo("v3"), memo("v4"), memo("v5"));

    const result = await app.execute(CodeRoutedCreditWorkflowStart, SOUND_APPLICATION, {
      record: true,
    });

    expect(result).toFinishWith(CreditApprovedWorkflowFinish, {
      text: "v5",
      recommendedLimitUsd: 35_000,
    });
    expect(mockLlm(MemoEditorAgent).requests).toHaveLength(4);
    expect(mockLlm(RiskOfficerAgent).requests).toHaveLength(5);
    expect(result.handledErrors).toEqual([]);
  });

  test("AC3: a critic that never accepts ends at credit-escalated-workflow-finish after 4 editor visits", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(CreditAnalystAgent).thenReturn(memo("v1"));
    mockLlm(RiskOfficerAgent).thenReturnAlways(changes("still not convincing"));
    mockLlm(MemoEditorAgent).thenReturn(memo("v2"), memo("v3"), memo("v4"), memo("v5", 30_000));

    const result = await app.execute(CodeRoutedCreditWorkflowStart, SOUND_APPLICATION, {
      record: true,
    });

    expect(result).toFollowPath([
      CodeRoutedCreditWorkflowStart,
      CreditLimitCodeRouter,
      CreditAnalystAgent,
      RiskOfficerAgent,
      MemoEditorAgent,
      RiskOfficerAgent,
      MemoEditorAgent,
      RiskOfficerAgent,
      MemoEditorAgent,
      RiskOfficerAgent,
      MemoEditorAgent,
      RiskOfficerAgent,
      MemoEditorAgent, // the fifth visit: refused before its model call, taken by .onError
      EscalateToCommitteeAction,
      CreditEscalatedWorkflowFinish,
    ]);
    expect(result).toHaveHandledError(VisitsLimitExceededError, {
      at: MemoEditorAgent,
      by: EscalateToCommitteeAction,
    });
    expect(result.record?.lastError).toMatchObject({ code: "limit.visits" });
    expect(result).toFinishWith(CreditEscalatedWorkflowFinish, {
      applicantName: "Dana Levi",
      lastMemo: "v5",
      openRequest: "still not convincing",
      recommendedLimitUsd: 30_000,
    });
    // four model calls of the editor, five of the officer: the loop never ran past its limits
    expect(mockLlm(MemoEditorAgent).requests).toHaveLength(4);
    expect(mockLlm(RiskOfficerAgent).requests).toHaveLength(5);
  });

  test("AC3: the editor reads the current memo and at most two earlier ones", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(CreditAnalystAgent).thenReturn(memo("v1"));
    mockLlm(RiskOfficerAgent).thenReturnAlways(changes("again"));
    mockLlm(MemoEditorAgent).thenReturn(memo("v2"), memo("v3"), memo("v4"), memo("v5"));

    await app.execute(CodeRoutedCreditWorkflowStart, SOUND_APPLICATION);

    const seen = mockLlm(MemoEditorAgent).inputs.map((input) => ({
      current: input.memo.current.value.text,
      previous: input.memo.previous.map((earlier) => earlier.value.text),
    }));
    // visit 1: nothing earlier; visit 2: one; visit 3: two; visit 4: still two — the latest two,
    // oldest first: the limit dropped v1, the analyst's memo, though the editor's visits allowed it
    expect(seen).toEqual([
      { current: "v1", previous: [] },
      { current: "v2", previous: ["v1"] },
      { current: "v3", previous: ["v1", "v2"] },
      { current: "v4", previous: ["v2", "v3"] },
    ]);
  });

  test("a request for changes is about the memo: a rewrite outdates it, the officer reads the new memo", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(CreditAnalystAgent).thenReturn(memo("v1"));
    mockLlm(RiskOfficerAgent).thenReturn(changes("shorter"), approved());
    mockLlm(MemoEditorAgent).thenReturn(memo("v2 shorter"));

    const result = await app.execute(CodeRoutedCreditWorkflowStart, SOUND_APPLICATION, {
      record: true,
    });

    expect(result).toFinishWith(CreditApprovedWorkflowFinish, {
      text: "v2 shorter",
      recommendedLimitUsd: 35_000,
    });
    // the officer's request was built from memo v1: the editor's v2 outdated it (caseOf … { about })
    const outdated = result.record?.outdatedValues.map(({ producer, variant }) => ({
      producer,
      variant,
    }));
    expect(outdated).toContainEqual({
      producer: "risk-officer-agent",
      variant: "MemoChangesRequestedDto",
    });
  });
});

describe("the model-routed start reaches the same loop", () => {
  test("AC3: the stubborn critic escalates on the model-routed start too", async ({
    app,
    mockLlm,
  }) => {
    mockLlm(CreditIntentModelRouter).thenReturn(routeTo(CreditAnalystAgent, { cost: ROUTER_COST }));
    mockLlm(CreditAnalystAgent).thenReturn(memo("v1"));
    mockLlm(RiskOfficerAgent).thenReturnAlways(changes("no"));
    mockLlm(MemoEditorAgent).thenReturn(memo("v2"), memo("v3"), memo("v4"), memo("v5"));

    const result = await app.execute(ModelRoutedCreditWorkflowStart, SOUND_APPLICATION);

    expect(result.output).toMatchObject({ lastMemo: "v5", openRequest: "no" });
    expect(result.finish?.name).toBe("credit-escalated-workflow-finish");
    expect(result).toHaveHandledError(VisitsLimitExceededError);
  });
});
