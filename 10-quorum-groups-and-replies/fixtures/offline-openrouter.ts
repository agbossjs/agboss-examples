/**
 * The offline OpenRouter of `npm run demo` and `tests/demo.test.ts`: a scripted stand-in for the two
 * HTTP APIs the application's model providers call — chat completions (`OpenRouterModelProvider`:
 * the reviewers, the order agent, the reply interpreter) and the Decisions API
 * (`DecisionsModelProvider`: the model arbiter). It is passed as `createApp({ providerFetch })`, so
 * the real providers, cost readers and budgets run; only the wire is scripted. Tests never use it:
 * they script models with `mockLlm`.
 *
 * Each reviewer answers within the policy and cites what it rests on — except, with
 * `uncitedCompliance`, the compliance reviewer, which cites nothing (the disagreement). The reply
 * interpreter reads "up to $N" as an approval capped at N, "yes" / "ok" / "approved" as an
 * approval, "no" as a refusal, and anything else as no decision at all.
 */
import { CAREFUL_CHAT_MODEL, CHAT_MODEL } from "../src/model-providers/models.js";

export interface OfflineOpenRouterOptions {
  /** The compliance reviewer cites no clause: its answer is rejected, group 1 cannot complete. */
  readonly uncitedCompliance?: boolean;
}

export interface OfflineOpenRouter {
  readonly fetch: typeof fetch;
  /** Every chat completion and decision answered, in order, by who asked (`/models` is not listed). */
  readonly calls: readonly string[];
}

/** What every chat completion and every decision reports as its cost. */
export const CHAT_COST_USD = 0.00002;
export const DECISION_COST_USD = 0.000004;

interface WireMessage {
  readonly role: string;
  readonly content?: unknown;
}

interface ChatBody {
  readonly model?: string;
  readonly messages?: readonly WireMessage[];
  readonly tools?: readonly { readonly function: { readonly name: string } }[];
}

interface DecisionBody {
  readonly model?: string;
  readonly state: unknown;
  readonly questions: Readonly<Record<string, { readonly type: string }>>;
}

type Reply = { readonly content: string } | { readonly tool: string; readonly args: object };

const textOf = (content: unknown): string =>
  typeof content === "string" ? content : JSON.stringify(content ?? "");

const numberField = (text: string, field: string): number =>
  Number(new RegExp(`"${field}":\\s*(\\d+)`).exec(text)?.[1] ?? "0");
const textField = (text: string, field: string): string => {
  const raw = new RegExp(`"${field}":\\s*("(?:[^"\\\\]|\\\\.)*")`).exec(text)?.[1];
  return raw === undefined ? "" : (JSON.parse(raw) as string);
};

/** The purchase request of a message, as the framework renders it. */
const requestOf = (message: string) => ({
  supplier: textField(message, "supplier"),
  itemDescription: textField(message, "itemDescription"),
  amountUsd: numberField(message, "amountUsd"),
});

function review(tool: string, message: string, options: OfflineOpenRouterOptions): Reply {
  const { amountUsd } = requestOf(message);
  switch (tool) {
    case "answer-legal-review-dto":
      return {
        tool,
        args: { clause: "§7.2 liability cap", isCleared: true, findings: "Standard terms; liability capped at the order value." },
      };
    case "answer-compliance-review-dto":
      return options.uncitedCompliance === true
        ? { tool, args: { clause: "", isCompliant: true, findings: "Looks fine to me." } }
        : {
            tool,
            args: { clause: "PP-4.1 vendor vetting", isCompliant: true, findings: "Vetted supplier, no sanctions hit." },
          };
    case "answer-price-benchmark-dto":
      return {
        tool,
        args: { source: "three quotes, 2026-10", benchmarkUsd: Math.round(amountUsd * 1.04), isFairPrice: true, findings: "Within the market range." },
      };
    default:
      return {
        tool,
        args: { budgetLine: "OPEX-IT-2026", remainingUsd: 10_000 - amountUsd, findings: "The line carries it." },
      };
  }
}

/** The order agent: call the tool once, then report what it answered (or the refusal). */
function purchaseOrder(messages: readonly WireMessage[]): Reply {
  const request = requestOf(textOf(messages.find((m) => m.role === "user")?.content));
  const toolResult = messages.findLast((m) => m.role === "tool");
  if (toolResult === undefined) return { tool: "place-purchase-order-tool", args: request };
  const result = textOf(toolResult.content);
  const reference = textField(result, "reference");
  return {
    tool: "answer-purchase-order-dto",
    args:
      reference === ""
        ? { supplier: request.supplier, isOrdered: false, amountUsd: 0, note: `Not ordered: ${result.slice(0, 120)}` }
        : { supplier: request.supplier, isOrdered: true, amountUsd: numberField(result, "amountUsd"), note: reference },
  };
}

/** The reply interpreter: the approver's words, after `### reply`, into a decision — or none. */
function interpretation(message: string): Reply {
  const raw = /### reply\s*\n("(?:[^"\\]|\\.)*")/.exec(message)?.[1];
  const reply = raw === undefined ? "" : (JSON.parse(raw) as string);
  const tool = "answer-tool-call-approval-decision-dto";
  const cap = /up to \$?(\d[\d,]*)/i.exec(reply)?.[1];
  if (cap !== undefined) {
    const args = textOf(message);
    const asked = {
      supplier: textField(args, "supplier"),
      itemDescription: textField(args, "itemDescription"),
      amountUsd: Number(cap.replace(/,/g, "")),
    };
    return { tool, args: { approved: true, reason: reply, overrideArguments: asked } };
  }
  if (/^\s*(yes|ok|approved?)\b/i.test(reply)) return { tool, args: { approved: true, reason: reply } };
  if (/^\s*no\b/i.test(reply)) return { tool, args: { approved: false, reason: reply } };
  return { content: "The reply does not say whether the order is approved." };
}

function replyOf(body: ChatBody, options: OfflineOpenRouterOptions): { who: string; reply: Reply } {
  const tools = (body.tools ?? []).map((tool) => tool.function.name);
  const messages = body.messages ?? [];
  const message = textOf(messages.findLast((m) => m.role === "user")?.content);
  if (tools.includes("place-purchase-order-tool"))
    return { who: "purchase-order-agent", reply: purchaseOrder(messages) };
  if (tools.includes("answer-tool-call-approval-decision-dto"))
    return { who: "purchase-reply-interpreter", reply: interpretation(message) };
  const [tool = ""] = tools;
  return { who: tool.replace(/^answer-/, "").replace(/-dto$/, "-agent"), reply: review(tool, message, options) };
}

let callIds = 0;

function completion(body: ChatBody, reply: Reply): Response {
  callIds += 1;
  const message =
    "content" in reply
      ? { role: "assistant", content: reply.content }
      : {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: `call-offline-${String(callIds)}`,
              type: "function",
              function: { name: reply.tool, arguments: JSON.stringify(reply.args) },
            },
          ],
        };
  const promptTokens = Math.round(JSON.stringify(body.messages ?? []).length / 4);
  const completionTokens = Math.round(JSON.stringify(message).length / 4);
  return Response.json({
    id: `chatcmpl-offline-${String(callIds)}`,
    object: "chat.completion",
    created: 1_790_000_000,
    model: body.model,
    provider: "offline-fixture",
    choices: [{ index: 0, message, finish_reason: "content" in reply ? "stop" : "tool_calls" }],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      cost: CHAT_COST_USD,
    },
  });
}

const urlOf = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

/** A scripted OpenRouter: `/models`, `/chat/completions` and `/alpha/decisions`, nothing else. */
export function createOfflineOpenRouter(options: OfflineOpenRouterOptions = {}): OfflineOpenRouter {
  const calls: string[] = [];
  const offlineFetch: typeof fetch = (input, init) => {
    const url = urlOf(input);
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    if (url.endsWith("/models")) {
      return Promise.resolve(
        Response.json({
          data: [CHAT_MODEL, CAREFUL_CHAT_MODEL].map((id) => ({
            id,
            supported_parameters: ["temperature", "max_tokens", "tools"],
            pricing: { prompt: "0.0000001", completion: "0.0000004" },
          })),
        }),
      );
    }
    if (url.endsWith("/alpha/decisions")) {
      const decision = body as DecisionBody;
      const answers = Object.fromEntries(
        Object.keys(decision.questions).map((id) => [id, { type: "noul", noul: 0.9 }]),
      );
      calls.push("policy-judgement-arbiter");
      return Promise.resolve(
        Response.json({
          model: decision.model,
          answers,
          usage: { input_tokens: 100, output_tokens: 1, cost: DECISION_COST_USD },
        }),
      );
    }
    if (url.endsWith("/chat/completions")) {
      const chat = body as ChatBody;
      const { who, reply } = replyOf(chat, options);
      calls.push(who);
      return Promise.resolve(completion(chat, reply));
    }
    return Promise.resolve(new Response(`offline OpenRouter has no ${url}`, { status: 404 }));
  };
  return { fetch: offlineFetch, calls };
}

/**
 * The disagreement of `npm run demo:live`: OpenRouter as it is, except the compliance reviewer —
 * answered here, without a clause. The rest of the run is real models.
 */
export function withUncitedCompliance(send: typeof fetch): typeof fetch {
  const scripted = createOfflineOpenRouter({ uncitedCompliance: true });
  const uncitedFetch: typeof fetch = (input, init) => {
    const body = typeof init?.body === "string" ? init.body : "";
    return urlOf(input).endsWith("/chat/completions") && body.includes("answer-compliance-review-dto")
      ? scripted.fetch(input, init)
      : send(input, init);
  };
  return uncitedFetch;
}
