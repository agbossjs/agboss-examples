import { MODEL_MAX } from "graphinject";

/** Settings the template's bundles share. Prices: USD per 1M tokens — verify on openrouter.ai/models. */
export const KIMI = "moonshotai/kimi-k2.6";
export const KIMI_PRICE = { inputPerMTok: 0.4972, outputPerMTok: 2.97, cacheReadPerMTok: 0.1284 };

export const DEFAULTS = {
  chat: { temperature: 0, maxTokens: MODEL_MAX, thinking: "default", cache: true },
  router: { kind: "jev", model: "typesafe/jev-1.13" },
  tools: { maxToolCalls: 8 },
  history: { limit: 5 },
} as const;

export const BUDGET = { runBudgetCap: 0.05, dailyBudgetCap: 2, evalBudgetCap: 1 };

/** Routers use `defaults.router` (Jev) unless they set their own `model` (e.g. an LLM router). */
export const ROUTERS = { main: { maxHops: 3 } };

export const GUARDS = {
  input: { prompt_injection: { threshold: 0.7, refusal: "I can't help with that request." } },
  output: {
    pii: { threshold: 0.7, refusal: "The answer contained personal data and was withheld." },
  },
};
