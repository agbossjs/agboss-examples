import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

export interface ContractDraft {
  readonly contractId: string;
  readonly summary: string;
  readonly fastTrackRequested: boolean;
}

export interface ComplianceApproval {
  readonly reviewer: string;
  readonly certificateId: string;
}

/**
 * Conventional LangGraph state bag: because `approval` does not exist at workflow start,
 * it must be typed as `ComplianceApproval | undefined`. TypeScript (`tsc --noEmit`) cannot
 * detect that the `"fast_track"` route reaches `publishContract` without setting `approval`.
 */
export const ContractStateAnnotation = Annotation.Root({
  draft: Annotation<ContractDraft>(),
  approval: Annotation<ComplianceApproval | undefined>(),
  publishedRecord: Annotation<string | undefined>(),
});

export type ContractState = typeof ContractStateAnnotation.State;

export function buildBrokenMissingInputLangGraph() {
  return new StateGraph(ContractStateAnnotation)
    .addNode("triage", (state: ContractState) => ({ draft: state.draft }))
    .addNode("complianceReview", (state: ContractState) => ({
      approval: {
        reviewer: "compliance-bot",
        certificateId: `CERT-${state.draft.contractId}`,
      },
    }))
    .addNode("publishContract", (state: ContractState) => {
      // Runtime failure on fast_track: state.approval is undefined!
      const cert = state.approval!.certificateId.toUpperCase();
      return {
        publishedRecord: `PUBLISHED:${state.draft.contractId}:${cert}`,
      };
    })
    .addEdge(START, "triage")
    .addConditionalEdges("triage", (state: ContractState) =>
      state.draft.fastTrackRequested ? "publishContract" : "complianceReview",
    )
    .addEdge("complianceReview", "publishContract")
    .addEdge("publishContract", END)
    .compile();
}
