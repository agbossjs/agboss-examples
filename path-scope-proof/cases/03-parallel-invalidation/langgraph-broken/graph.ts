import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

export interface QuoteSheet {
  readonly quoteId: string;
  readonly subtotalUsd: number;
}

export interface TaxAuditReport {
  readonly auditedSubtotalUsd: number;
  readonly taxUsd: number;
}

/**
 * Conventional LangGraph parallel fan-out: `pricingRewriter` and `taxAudit` run in parallel
 * from `quoteBuilder`. `pricingRewriter` mutates `quoteSheet.subtotalUsd` from $1,000 to $850,
 * while `taxAudit` concurrently computes tax on the pre-launch $1,000 subtotal.
 * At `assembleInvoice`, `quoteSheet.subtotalUsd` is $850 while `taxAuditReport.auditedSubtotalUsd`
 * is still $1,000 — silent parallel data invalidation that passes `tsc --noEmit`!
 */
export const ParallelStateAnnotation = Annotation.Root({
  quoteId: Annotation<string>(),
  quoteSheet: Annotation<QuoteSheet | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  taxAuditReport: Annotation<TaxAuditReport | undefined>({
    reducer: (_prev, next) => next,
    default: () => undefined,
  }),
  invoiceSummary: Annotation<
    { readonly subtotalUsd: number; readonly auditedSubtotalUsd: number } | undefined
  >(),
});

export type ParallelState = typeof ParallelStateAnnotation.State;

export function buildBrokenParallelInvalidationLangGraph() {
  return new StateGraph(ParallelStateAnnotation)
    .addNode("quoteBuilder", (state: ParallelState) => ({
      quoteSheet: { quoteId: state.quoteId, subtotalUsd: 1000 },
    }))
    .addNode("pricingRewriter", (state: ParallelState) => ({
      // Replaces quoteSheet in parallel!
      quoteSheet: {
        quoteId: state.quoteSheet!.quoteId,
        subtotalUsd: 850,
      },
    }))
    .addNode("taxAudit", (state: ParallelState) => ({
      // Reads pre-launch quoteSheet ($1000) while sibling rewrites it to $850!
      taxAuditReport: {
        auditedSubtotalUsd: state.quoteSheet!.subtotalUsd,
        taxUsd: Math.round(state.quoteSheet!.subtotalUsd * 0.1),
      },
    }))
    .addNode("assembleInvoice", (state: ParallelState) => ({
      invoiceSummary: {
        subtotalUsd: state.quoteSheet!.subtotalUsd,
        auditedSubtotalUsd: state.taxAuditReport!.auditedSubtotalUsd,
      },
    }))
    .addEdge(START, "quoteBuilder")
    .addEdge("quoteBuilder", "pricingRewriter")
    .addEdge("quoteBuilder", "taxAudit")
    .addEdge("pricingRewriter", "assembleInvoice")
    .addEdge("taxAudit", "assembleInvoice")
    .addEdge("assembleInvoice", END)
    .compile();
}
