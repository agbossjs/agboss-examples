import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

export interface ContractDraft {
  readonly version: number;
  readonly clauses: string;
}

export interface LegalSignoff {
  readonly approvedVersion: number;
  readonly signature: string;
}

/**
 * Conventional LangGraph state bag: when a revision loop rewrites `draft` (version 2),
 * `legalSignoff` from version 1 remains in state unless manually cleared and recomputed.
 * `tsc --noEmit` passes without error, and `finalizeContract` silently pairs version 2
 * of the contract with version 1's legal sign-off!
 */
export const OutdatedStateAnnotation = Annotation.Root({
  topic: Annotation<string>(),
  draft: Annotation<ContractDraft | undefined>(),
  legalSignoff: Annotation<LegalSignoff | undefined>(),
  needsRevision: Annotation<boolean | undefined>(),
  finalizedContract: Annotation<
    { readonly draftVersion: number; readonly signoffVersion: number } | undefined
  >(),
});

export type OutdatedState = typeof OutdatedStateAnnotation.State;

export function buildBrokenOutdatedDataLangGraph() {
  return new StateGraph(OutdatedStateAnnotation)
    .addNode("draftWriter", (state: OutdatedState) => ({
      draft: { version: 1, clauses: `Initial clauses for ${state.topic}` },
    }))
    .addNode("legalCheck", (state: OutdatedState) => ({
      legalSignoff: {
        approvedVersion: state.draft!.version,
        signature: `LEGAL-SIG-v${String(state.draft!.version)}`,
      },
    }))
    .addNode("qualityReview", () => ({
      needsRevision: true,
    }))
    .addNode("revisionWriter", (state: OutdatedState) => ({
      // Replaces `draft` with version 2, leaving `legalSignoff` stale at version 1!
      draft: {
        version: (state.draft?.version ?? 1) + 1,
        clauses: `Revised clauses for ${state.topic}`,
      },
      needsRevision: false,
    }))
    .addNode("finalizeContract", (state: OutdatedState) => ({
      finalizedContract: {
        draftVersion: state.draft!.version,
        signoffVersion: state.legalSignoff!.approvedVersion,
      },
    }))
    .addEdge(START, "draftWriter")
    .addEdge("draftWriter", "legalCheck")
    .addEdge("legalCheck", "qualityReview")
    .addConditionalEdges("qualityReview", (state: OutdatedState) =>
      state.needsRevision ? "revisionWriter" : "finalizeContract",
    )
    // BUG: revisionWriter goes directly to finalizeContract without re-running legalCheck!
    .addEdge("revisionWriter", "finalizeContract")
    .addEdge("finalizeContract", END)
    .compile();
}
