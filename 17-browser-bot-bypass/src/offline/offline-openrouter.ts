/**
 * The offline OpenRouter of `npm run demo`: a scripted stand-in for the chat completions the built-in
 * provider calls, served on 127.0.0.1 through `OPENROUTER_BASE_URL` (`serveFetch`) — the real
 * provider, the tool calls, the cost reader and the budgets run; only the wire is scripted. The
 * "model" calls the page tool with the URL it finds in the user's request, and answers from the
 * tool's result.
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

/** The final answer, from the tool's result. */
function finalAnswerOf(messages: readonly WireMessage[]): string {
  const tool = messages.filter((message) => message.role === "tool").map((message) => textOf(message.content)).join("\n");
  if (/refused/u.test(tool)) return "That address is not an allowed site, so I did not open it.";
  const price = /Starter (\d+) USD/u.exec(tool)?.[1];
  return price === undefined ? `The tool answered: ${tool.slice(0, 80)}` : `The Starter plan is ${price} USD per agent per month.`;
}

/** A scripted OpenRouter: `/models` and `/chat/completions`, nothing else; `requests` counts what it received. */
export function createOfflineOpenRouter(): { readonly fetch: typeof fetch; readonly requests: { readonly messages: readonly WireMessage[] }[] } {
  const requests: { readonly messages: readonly WireMessage[] }[] = [];
  const offlineFetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = urlOf(input);
    if (url.endsWith("/models"))
      return Promise.resolve(
        Response.json({ data: [{ id: "openai/gpt-4.1-nano", supported_parameters: ["temperature", "max_tokens", "tools"] }] }),
      );
    if (!url.endsWith("/chat/completions"))
      return Promise.resolve(new Response(`offline OpenRouter has no ${url}`, { status: 404 }));
    const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
      readonly model?: string;
      readonly messages?: readonly WireMessage[];
      readonly tools?: readonly { readonly function?: { readonly name?: string } }[];
    };
    const messages = body.messages ?? [];
    requests.push({ messages });
    const tool = body.tools?.find((each) => each.function?.name?.startsWith("open-page-stealth"))?.function?.name;
    const ask = textOf(messages.find((message) => message.role === "user")?.content);
    const pageUrl = /https?:\/\/[^\s"'\\]+/u.exec(ask)?.[0];
    const call = tool !== undefined && pageUrl !== undefined && !messages.some((message) => message.role === "tool") ? { name: tool, url: pageUrl } : undefined;
    const message =
      call === undefined
        ? { role: "assistant", content: finalAnswerOf(messages) }
        : {
            role: "assistant",
            content: null,
            tool_calls: [{ id: `call_${String(requests.length)}`, type: "function", function: { name: call.name, arguments: JSON.stringify({ url: call.url }) } }],
          };
    return Promise.resolve(
      Response.json({
        id: `chatcmpl-offline-${String(requests.length)}`,
        object: "chat.completion",
        created: 1_790_000_000,
        model: body.model,
        choices: [{ index: 0, message, finish_reason: call === undefined ? "stop" : "tool_calls" }],
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110, cost: CHAT_COST_USD },
      }),
    );
  }) as typeof fetch;
  return { fetch: offlineFetch, requests };
}
