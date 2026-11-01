/**
 * The offline OpenRouter of `npm run demo` and `tests/demo.test.ts`: a scripted stand-in for the two
 * HTTP APIs the application's model providers call — chat completions (`OpenRouterModelProvider`,
 * the agents) and the Decisions API (`DecisionsModelProvider`, the model router). It is passed as
 * `createApp({ providerFetch })`, so the real providers, their retry policies, cost readers and the
 * budgets all run; only the wire is scripted. Tests never use it: they script models with `mockLlm`.
 *
 * Jev routes by the bank's thresholds, read from the application in its state. The analyst writes a
 * memo without its risk line; the risk officer asks for it once, then approves — or, stubborn,
 * always asks for changes. Every answer carries `usage.cost`, so the cost report is the providers'
 * own accounting.
 */
import { CHAT_MODEL } from "../src/model-providers/models.js";

/** What one call was: a chat completion of an agent, or a decision. */
export interface OfflineCall {
  readonly kind: "chat" | "decision";
  /** The agent (by its prompt and answer tools) or the decision's question ids. */
  readonly about: string;
}

export interface OfflineOpenRouter {
  readonly fetch: typeof fetch;
  /** Every chat completion and decision answered, in order (`/models` is not listed). */
  readonly calls: readonly OfflineCall[];
}

export interface OfflineOpenRouterOptions {
  /** The risk officer never approves (the failure injection of the review loop). */
  readonly stubbornCritic?: boolean;
}

/** What every chat completion and every decision reports as its cost. */
export const CHAT_COST_USD = 0.00002;
export const DECISION_COST_USD = 0.000004;

const APPROVE_TOOL = "answer-memo-approved-dto";
const CHANGES_TOOL = "answer-memo-changes-requested-dto";
const MEMO_TOOL = "answer-credit-memo-dto";
const RISK_LINE = "Main risk:";

interface WireMessage {
  readonly role: string;
  readonly content?: unknown;
}

interface ChatBody {
  readonly model?: string;
  readonly messages?: readonly WireMessage[];
  readonly tools?: readonly { readonly function: { readonly name: string } }[];
}

interface Question {
  readonly type: string;
  readonly criteria?: Readonly<Record<string, string>>;
}

interface DecisionBody {
  readonly model?: string;
  readonly state: unknown;
  readonly questions: Readonly<Record<string, Question>>;
}

/** The numbers of the application, as the framework renders it in a message or a decision's state. */
interface ApplicationNumbers {
  readonly applicantName: string;
  readonly purpose: string;
  readonly amountUsd: number;
  readonly creditScore: number;
  readonly debtToIncome: number;
}

const textOf = (content: unknown): string =>
  typeof content === "string" ? content : JSON.stringify(content ?? "");

const fieldOf = (text: string, field: string): string =>
  new RegExp(`"${field}":\\s*("(?:[^"\\\\]|\\\\.)*"|[\\d.]+)`).exec(text)?.[1] ?? "0";

function applicationOf(text: string): ApplicationNumbers {
  const textField = (field: string): string => JSON.parse(fieldOf(text, field)) as string;
  return {
    applicantName: textField("applicantName"),
    purpose: textField("purpose"),
    amountUsd: Number(fieldOf(text, "amountUsd")),
    creditScore: Number(fieldOf(text, "creditScore")),
    debtToIncome: Number(fieldOf(text, "debtToIncome")),
  };
}

/** The bank's thresholds, as a careful decision model reads them. */
const isDeclined = ({ creditScore, debtToIncome, amountUsd }: ApplicationNumbers): boolean =>
  creditScore < 600 || debtToIncome > 0.45 || amountUsd > 250_000;

function decisionOf(question: Question, state: string): Record<string, unknown> {
  const options = Object.keys(question.criteria ?? {});
  const wanted = isDeclined(applicationOf(state))
    ? "credit-declined-workflow-finish"
    : "credit-analyst-agent";
  const choice = options.includes(wanted) ? wanted : (options[0] ?? "");
  return { type: "choice", choice, probabilities: { [choice]: 0.97 }, confidence: 0.97 };
}

type Reply = { readonly tool: string; readonly args: object };

/** The newest memo of a message: its `"text"` field, after the application's block. */
const memoTextOf = (message: string): string => {
  const memoBlock = message.slice(message.indexOf("### memo"));
  return JSON.parse(fieldOf(memoBlock, "text")) as string;
};

function analyst(message: string): Reply {
  const application = applicationOf(message);
  const limit = Math.round(application.amountUsd * 0.9);
  return {
    tool: MEMO_TOOL,
    args: {
      text: `${application.applicantName} asks for $${String(application.amountUsd)}: ${application.purpose}. Credit score ${String(application.creditScore)}. Recommended limit $${String(limit)}.`,
      recommendedLimitUsd: limit,
    },
  };
}

function editor(message: string): Reply {
  const application = applicationOf(message);
  const memo = memoTextOf(message);
  const limit = Math.round(application.amountUsd * 0.9);
  const text = memo.includes(RISK_LINE)
    ? `${memo} Revised again.`
    : `${memo} ${RISK_LINE} a debt-to-income ratio of ${String(application.debtToIncome)}.`;
  return { tool: MEMO_TOOL, args: { text, recommendedLimitUsd: limit } };
}

function riskOfficer(message: string, isStubborn: boolean): Reply {
  if (isStubborn) {
    return {
      tool: CHANGES_TOOL,
      args: { notes: "Not convincing yet: justify the limit against the income." },
    };
  }
  return memoTextOf(message).includes(RISK_LINE)
    ? { tool: APPROVE_TOOL, args: { note: "Complete: applicant, purpose, risk and limit." } }
    : { tool: CHANGES_TOOL, args: { notes: "Name the main risk in the numbers." } };
}

function replyOf(
  body: ChatBody,
  options: OfflineOpenRouterOptions,
): { agent: string; reply: Reply } {
  const tools = (body.tools ?? []).map((tool) => tool.function.name);
  const messages = body.messages ?? [];
  const system = textOf(messages.find((m) => m.role === "system")?.content);
  const message = textOf(messages.findLast((m) => m.role === "user")?.content);
  if (tools.includes(APPROVE_TOOL))
    return {
      agent: "risk-officer-agent",
      reply: riskOfficer(message, options.stubbornCritic === true),
    };
  if (system.includes("credit analyst"))
    return { agent: "credit-analyst-agent", reply: analyst(message) };
  return { agent: "memo-editor-agent", reply: editor(message) };
}

let callIds = 0;

function completion(body: ChatBody, reply: Reply): Response {
  callIds += 1;
  const message = {
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
    choices: [{ index: 0, message, finish_reason: "tool_calls" }],
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
  const calls: OfflineCall[] = [];
  const offlineFetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = urlOf(input);
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : {};
    if (url.endsWith("/models")) {
      return Promise.resolve(
        Response.json({
          data: [
            {
              id: CHAT_MODEL,
              supported_parameters: ["temperature", "max_tokens", "tools"],
              pricing: { prompt: "0.0000001", completion: "0.0000004" },
            },
          ],
        }),
      );
    }
    if (url.endsWith("/alpha/decisions")) {
      const decision = body as DecisionBody;
      const state = textOf(decision.state);
      const answers = Object.fromEntries(
        Object.entries(decision.questions).map(([id, question]) => [
          id,
          decisionOf(question, state),
        ]),
      );
      calls.push({ kind: "decision", about: Object.keys(decision.questions).join(",") });
      return Promise.resolve(
        Response.json({
          model: decision.model,
          answers,
          usage: {
            input_tokens: Math.round(state.length / 4),
            output_tokens: 1,
            cost: DECISION_COST_USD,
          },
        }),
      );
    }
    if (url.endsWith("/chat/completions")) {
      const chat = body as ChatBody;
      const { agent, reply } = replyOf(chat, options);
      calls.push({ kind: "chat", about: agent });
      return Promise.resolve(completion(chat, reply));
    }
    return Promise.resolve(new Response(`offline OpenRouter has no ${url}`, { status: 404 }));
  }) as typeof fetch;
  return { fetch: offlineFetch, calls };
}

/**
 * The failure injection of `npm run demo:live`: OpenRouter as it is, except the risk officer's calls
 * — answered here, always with a request for changes. The rest of the run is real models.
 */
export function withStubbornCritic(send: typeof fetch): typeof fetch {
  const stubborn = createOfflineOpenRouter({ stubbornCritic: true });
  const stubbornFetch: typeof fetch = (input, init) => {
    const body = typeof init?.body === "string" ? init.body : "";
    return urlOf(input).endsWith("/chat/completions") && body.includes(APPROVE_TOOL)
      ? stubborn.fetch(input, init)
      : send(input, init);
  };
  return stubbornFetch;
}
