/**
 * Conventional 15-field LangGraph application (`source/legacy-langgraph/support.graph.ts`).
 *
 * Demonstrates the four classic shared-state anti-patterns documented in
 * `13-migrating-from-langgraph.md`:
 *   1. One "God State" (`SupportState`) with 15 fields where every node can read/write anything.
 *   2. `write` reads `state.draft` and `state.critique` on its very first visit when both are
 *      `undefined` (interpolating `"Draft: undefined"` into the prompt).
 *   3. `unusedDebugNote` is written by `classify` and never read by any downstream node.
 *   4. Unbounded `Send("research", ...)` fan-out with manual array reducer concatenation.
 */

export interface LegacySupportState {
  readonly orderId: string;
  readonly customerId: string;
  readonly customerEmail: string;
  readonly message: string;
  readonly category?: "refund" | "other";
  readonly questions: readonly string[];
  readonly question?: string;
  readonly findings: readonly string[];
  readonly draft?: string;
  readonly refundCents: number;
  readonly critique?: string;
  readonly approved: boolean;
  readonly revisions: number;
  readonly refundId?: string;
  readonly unusedDebugNote?: string;
}

export const LEGACY_STATE_FIELD_NAMES: readonly (keyof LegacySupportState)[] = [
  "orderId",
  "customerId",
  "customerEmail",
  "message",
  "category",
  "questions",
  "question",
  "findings",
  "draft",
  "refundCents",
  "critique",
  "approved",
  "revisions",
  "refundId",
  "unusedDebugNote",
] as const;

export interface LegacyExecutionTrace {
  readonly finalState: LegacySupportState;
  readonly visitedNodes: readonly string[];
  readonly firstWritePromptSawUndefinedDraft: boolean;
  readonlyfirstWritePromptSawUndefinedCritique: boolean;
  readonly unusedFieldPersistedInState: boolean;
  readonly pausedForSupervisorInterrupt: boolean;
}

const REFUND_SIGN_OFF_CENTS = 10_000;

export async function runLegacySupportGraph(input: {
  readonly orderId: string;
  readonly customerId: string;
  readonly customerEmail: string;
  readonly message: string;
  readonly requestedRefundCents?: number;
  readonly supervisorApproval?: boolean;
}): Promise<LegacyExecutionTrace> {
  const visitedNodes: string[] = [];
  let state: LegacySupportState = {
    orderId: input.orderId,
    customerId: input.customerId,
    customerEmail: input.customerEmail,
    message: input.message,
    questions: [],
    findings: [],
    refundCents: 0,
    approved: false,
    revisions: 0,
  };

  // 1. classify node
  visitedNodes.push("classify");
  const isRefund = state.message.toLowerCase().includes("refund");
  state = {
    ...state,
    category: isRefund ? "refund" : "other",
    unusedDebugNote: "classified-by-legacy-node",
  };

  if (state.category !== "refund") {
    return {
      finalState: state,
      visitedNodes,
      firstWritePromptSawUndefinedDraft: false,
      readonlyfirstWritePromptSawUndefinedCritique: false,
      unusedFieldPersistedInState: state.unusedDebugNote !== undefined,
      pausedForSupervisorInterrupt: false,
    };
  }

  // 2. plan node -> Send("research") per question
  visitedNodes.push("plan");
  const questions = ["Was the order delivered late?", "Is the item eligible for refund?"];
  state = { ...state, questions };

  // 3. parallel research fan-out with manual reducer concatenation
  const findings: string[] = [];
  for (const question of state.questions) {
    visitedNodes.push("research");
    const branchState: LegacySupportState = { ...state, question };
    findings.push(`${branchState.question ?? ""}: confirmed for order ${branchState.orderId}`);
  }
  state = { ...state, findings: [...state.findings, ...findings] };

  // 4. write -> review loop
  let firstWritePromptSawUndefinedDraft = false;
  let firstWritePromptSawUndefinedCritique = false;

  while (true) {
    visitedNodes.push("write");
    if (state.revisions === 0) {
      // Latent bug in the legacy LangGraph node: reads state.draft & state.critique before they exist!
      const prompt = `Reply fixing: ${String(state.critique)}\nDraft: ${String(state.draft)}`;
      firstWritePromptSawUndefinedDraft = prompt.includes("Draft: undefined");
      firstWritePromptSawUndefinedCritique = prompt.includes("fixing: undefined");
    }

    const nextRevisions = state.revisions + 1;
    const draftText =
      nextRevisions === 1
        ? "Sorry — refund on its way."
        : "Four days late — sorry, refund on its way.";
    state = {
      ...state,
      draft: draftText,
      refundCents: input.requestedRefundCents ?? 2_500,
      revisions: nextRevisions,
    };

    visitedNodes.push("review");
    if (state.revisions === 1) {
      state = {
        ...state,
        approved: false,
        critique: "mention how many days late the delivery was",
      };
    } else {
      state = {
        ...state,
        approved: true,
        critique: "",
      };
    }

    if (state.approved) {
      break;
    }
    if (state.revisions >= 3) {
      return {
        finalState: state,
        visitedNodes,
        firstWritePromptSawUndefinedDraft,
        readonlyfirstWritePromptSawUndefinedCritique: firstWritePromptSawUndefinedCritique,
        unusedFieldPersistedInState: state.unusedDebugNote !== undefined,
        pausedForSupervisorInterrupt: false,
      };
    }
  }

  // 5. routeBySize -> signOff (interrupt) or issueRefund
  visitedNodes.push("routeBySize");
  let pausedForSupervisorInterrupt = false;
  if (state.refundCents > REFUND_SIGN_OFF_CENTS) {
    visitedNodes.push("signOff");
    pausedForSupervisorInterrupt = true;
    state = {
      ...state,
      approved: input.supervisorApproval ?? true,
    };
    if (!state.approved) {
      return {
        finalState: state,
        visitedNodes,
        firstWritePromptSawUndefinedDraft,
        readonlyfirstWritePromptSawUndefinedCritique: firstWritePromptSawUndefinedCritique,
        unusedFieldPersistedInState: state.unusedDebugNote !== undefined,
        pausedForSupervisorInterrupt,
      };
    }
  }

  // 6. issueRefund
  visitedNodes.push("issueRefund");
  state = {
    ...state,
    refundId: `refund-${state.orderId}-${String(state.refundCents)}`,
  };

  return {
    finalState: state,
    visitedNodes,
    firstWritePromptSawUndefinedDraft,
    readonlyfirstWritePromptSawUndefinedCritique: firstWritePromptSawUndefinedCritique,
    unusedFieldPersistedInState: state.unusedDebugNote !== undefined,
    pausedForSupervisorInterrupt,
  };
}
