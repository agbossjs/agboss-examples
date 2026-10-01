/**
 * Settings the job-scout workflow uses (its limits are in its `settings()`). Prices: USD per 1M
 * tokens — verify on openrouter.ai/models.
 */
export const KIMI = "moonshotai/kimi-k2.6";
export const KIMI_PRICE = { inputPerMTok: 0.4972, outputPerMTok: 2.97, cacheReadPerMTok: 0.1284 };

export const DEFAULTS = {
  // no maxTokens: GraphCompose's default ceiling (8192) applies
  chat: {
    temperature: 0,
    thinking: "default",
    cache: true,
    // kimi-k2.6 via Inceptron loops while generating tool-call arguments (seen in #92, #97)
    provider: { ignore: ["Inceptron"] },
  },
  router: { kind: "jev", model: "typesafe/jev-1.13" },
  tools: { maxToolCalls: 8 },
  history: { limit: 5 },
} as const;

export const GUARDS = {
  input: { prompt_injection: { threshold: 0.7, refusal: "I can't help with that request." } },
  output: {
    pii: { threshold: 0.7, refusal: "The answer contained personal data and was withheld." },
  },
};
