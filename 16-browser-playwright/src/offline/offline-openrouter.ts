/**
 * The offline OpenRouter of `npm run demo`: a scripted stand-in for the chat completions the built-in
 * provider calls, served on 127.0.0.1 through `OPENROUTER_BASE_URL` (`serveFetch`) — the real
 * provider, the file parts, the tool calls, the cost reader and the budgets run; only the wire is
 * scripted. The "model" reads the user's request for the one thing it asks, calls the tool for it
 * with the URL or the fields it finds in the text, and answers from the tool's result.
 */

/** What every chat completion reports as its cost. */
export const CHAT_COST_USD = 0.00002;

interface WireMessage {
  readonly role: string;
  readonly content?: unknown;
  readonly tool_calls?: readonly unknown[];
}

interface ToolCall {
  readonly name: string;
  readonly arguments: Record<string, string>;
}

/** One request the wire received: what the tests read to see what reached the model. */
export interface WireRequest {
  readonly messages: readonly WireMessage[];
}

const textOf = (content: unknown): string =>
  typeof content === "string" ? content : JSON.stringify(content ?? "");

const urlOf = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

/** Whether any message carries an image part: the screenshot reached the model as a file, not as text. */
export const hasImagePart = (messages: readonly WireMessage[]): boolean =>
  messages.some((message) => Array.isArray(message.content) && message.content.some((part: { type?: string }) => part.type === "image_url"));

/** The tool the request calls first, from what the user asked (the first user message). */
function firstCallOf(ask: string, tools: ReadonlySet<string>): ToolCall | undefined {
  const url = /https?:\/\/[^\s"']+/u.exec(ask)?.[0];
  const via = (plain: string, mcp: string): string => (tools.has(mcp) ? mcp : plain);
  if (/screenshot/iu.test(ask) && url !== undefined) return { name: "screenshot-tool", arguments: { url } };
  if (/file a request|contact/iu.test(ask)) {
    const field = (name: string): string => new RegExp(`${name}=([^;\\n"\\\\]+)`, "u").exec(ask)?.[1]?.trim() ?? "";
    return {
      name: via("submit-contact-tool", "submit-contact-mcp-tool"),
      arguments: { reference: field("reference"), name: field("name"), email: field("email"), message: field("message") },
    };
  }
  return url === undefined ? undefined : { name: via("open-page-tool", "open-page-mcp-tool"), arguments: { url } };
}

/** The final answer, from the tool's result (and from an image part, when one arrived). */
function finalAnswerOf(messages: readonly WireMessage[]): string {
  const tool = messages.filter((message) => message.role === "tool").map((message) => textOf(message.content)).join("\n");
  if (hasImagePart(messages)) return "I can see the screenshot: an image of the page reached me as a file.";
  if (/refused/u.test(tool)) return "That address is not an allowed site, so I did not open it.";
  const ticket = /\b(T-\d+)\b/u.exec(tool)?.[1];
  if (ticket !== undefined) return `Your request is filed as ${ticket}.`;
  const price = /Starter (\d+) USD/u.exec(tool)?.[1];
  if (price !== undefined) return `The Starter plan is ${price} USD per agent per month.`;
  return `The tool answered: ${tool.slice(0, 80)}`;
}

/** A scripted OpenRouter: `/models` and `/chat/completions`, nothing else; `requests` are what it received. */
export function createOfflineOpenRouter(): { readonly fetch: typeof fetch; readonly requests: WireRequest[] } {
  const requests: WireRequest[] = [];
  const offlineFetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = urlOf(input);
    if (url.endsWith("/models"))
      return Promise.resolve(
        Response.json({
          data: [
            {
              id: "openai/gpt-4.1-nano",
              architecture: { input_modalities: ["text", "image"] },
              supported_parameters: ["temperature", "max_tokens", "tools"],
            },
          ],
        }),
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
    const names = new Set((body.tools ?? []).flatMap((tool) => (tool.function?.name === undefined ? [] : [tool.function.name])));
    const ask = textOf(messages.find((message) => message.role === "user")?.content);
    const lastRole = messages.at(-1)?.role;
    // the first turn (the last message is the user's) calls the tool; a later one answers from its result
    const call = lastRole === "user" && !messages.some((message) => message.role === "tool") ? firstCallOf(ask, names) : undefined;
    const message =
      call === undefined
        ? { role: "assistant", content: finalAnswerOf(messages) }
        : {
            role: "assistant",
            content: null,
            tool_calls: [{ id: `call_${String(requests.length)}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) } }],
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
