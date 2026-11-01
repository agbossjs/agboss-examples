/**
 * The chat model of every agent: a cheap one that calls tools reliably (an agent answers through
 * its answer tool). Routers decide on Jev, a decision model of the OpenRouter Decisions API.
 * `npm run demo` never calls either: its OpenRouter is scripted (`fixtures/offline-openrouter.ts`).
 */
export const CHAT_MODEL = "google/gemini-2.5-flash-lite";

/** The decision model of the model router. */
export const DECISION_MODEL = "typesafe/jev-1.13";
