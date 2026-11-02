import type { RagSearchResultDto } from "@agboss/core/dto";

/**
 * Each tenant's handbook as the retriever ranks it for "When does a new engineer join on-call?":
 * thirty near-misses about the rota first — they repeat "on-call" — and the one passage that
 * answers 27th. A keyword retriever ranks like this all the time; a reranker reads the question.
 */
export const ANSWER = {
  source: "handbook/onboarding.md#on-call",
  text: "New engineers join the rotation after their third month, once they have shadowed two shifts.",
} as const;

const nearMiss = (index: number): RagSearchResultDto => ({
  source: `handbook/on-call-rota.md#${String(index + 1)}`,
  text: `On-call rota, on-call page ${String(index + 1)}: who is on-call this week and the on-call phone list.`,
});

/** The default tenant's handbook, in the retriever's order. */
export const HANDBOOK: readonly RagSearchResultDto[] = [
  ...Array.from({ length: 26 }, (_, index) => nearMiss(index)),
  ANSWER,
  ...Array.from({ length: 3 }, (_, index) => nearMiss(26 + index)),
];
