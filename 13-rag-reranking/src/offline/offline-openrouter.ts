/**
 * The offline OpenRouter of `npm run demo`: a scripted stand-in for the chat completions the
 * built-in provider calls, passed as `createApp({ providerFetch })` — the real provider, its cost
 * reader and the budgets run; only the wire is scripted. The agent answers from the first source of
 * the knowledge it was given; the LLM reranker (when swapped in) ranks candidate 27 first.
 */

/** What every chat completion reports as its cost. */
export const CHAT_COST_USD = 0.00002;

interface WireMessage {
  readonly role: string;
  readonly content?: unknown;
}

const textOf = (content: unknown): string =>
  typeof content === "string" ? content : JSON.stringify(content ?? "");

const urlOf = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

/** The agent's answer: the first `[source]` of its knowledge block, cited. */
function answerOf(messages: readonly WireMessage[]): string {
  const asked = messages.map((m) => textOf(m.content)).join("\n");
  if (asked.includes("You rerank search results")) return '{"ranking":[27]}';
  const source = /\[(handbook\/[^\]]+)\]/u.exec(asked)?.[1] ?? "nothing";
  return `From the handbook [${source}].`;
}

/** A scripted OpenRouter: `/models` and `/chat/completions`, nothing else; `answers` the replies sent. */
export function createOfflineOpenRouter(): { readonly fetch: typeof fetch; readonly answers: string[] } {
  const answers: string[] = [];
  const offlineFetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = urlOf(input);
    if (url.endsWith("/models"))
      return Promise.resolve(
        Response.json({
          data: [{ id: "openai/gpt-4.1-nano", supported_parameters: ["temperature", "max_tokens", "tools"] }],
        }),
      );
    if (!url.endsWith("/chat/completions"))
      return Promise.resolve(new Response(`offline OpenRouter has no ${url}`, { status: 404 }));
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
      readonly model?: string;
      readonly messages?: readonly WireMessage[];
    };
    const content = answerOf(body.messages ?? []);
    answers.push(content);
    return Promise.resolve(
      Response.json({
        id: `chatcmpl-offline-${String(answers.length)}`,
        object: "chat.completion",
        created: 1_790_000_000,
        model: body.model,
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110, cost: CHAT_COST_USD },
      }),
    );
  }) as typeof fetch;
  return { fetch: offlineFetch, answers };
}
