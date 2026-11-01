/**
 * The models, all cheap. The four reviewers answer one DTO each: the cheapest chat model that calls
 * its answer tool reliably. The order agent and the reply interpreter read a tool's result and a
 * person's words — the step where a guess costs money — on a slightly stronger one. The model
 * arbiter decides on Jev, a decision model of the OpenRouter Decisions API. `npm run demo` never
 * calls any of them: its OpenRouter is scripted (`fixtures/offline-openrouter.ts`).
 */
export const CHAT_MODEL = "openai/gpt-4.1-nano";

/** The order agent's and the reply interpreter's model. */
export const CAREFUL_CHAT_MODEL = "openai/gpt-4o-mini";

/** The decision model of the model arbiter. */
export const DECISION_MODEL = "typesafe/jev-1.13";
