/**
 * The offline OpenRouter of `npm run demo` and `tests/demo.test.ts`: a scripted stand-in for the two
 * HTTP APIs job-scout's model providers call — chat completions (`OpenRouterModelProvider`, Kimi)
 * and the Decisions API (`DecisionsModelProvider`, Jev). It is passed as `createApp({ providerFetch })`,
 * so every real provider, retry policy, cost reader and budget runs; only the wire is scripted.
 *
 * The script reads what the framework sends (the tools offered, the conversation, the tool results)
 * and answers as a well-behaved model would: the profiler reads the resume and proposes a brief, the
 * scout calls the Greenhouse tool once and lists what it returned, the shortlist agent saves the jobs
 * the user named. Jev answers every guardrail, route and job-fit question by a fixed rule. Every
 * answer carries `usage.cost`, so the cost report is the providers' own accounting.
 */

/** What one call was: a chat completion of an agent, or a decision (and its question ids). */
export interface OfflineCall {
  readonly kind: "chat" | "decision";
  /** The agent (by the tools it was offered) or the decision's question ids. */
  readonly about: string;
}

export interface OfflineOpenRouter {
  readonly fetch: typeof fetch;
  /** Every chat completion and decision answered, in order (`/models` is not listed). */
  readonly calls: readonly OfflineCall[];
}

export interface OfflineOpenRouterOptions {
  /** What every chat completion reports as its cost (default $0.0015). */
  readonly chatCostUsd?: number;
  /** What every decision reports as its cost (default $0.000004, Jev's order of magnitude). */
  readonly decisionCostUsd?: number;
}

export const CHAT_MODEL = "moonshotai/kimi-k2.6";

interface WireMessage {
  readonly role: string;
  readonly content?: unknown;
  readonly tool_calls?: readonly { readonly function: { readonly name: string } }[];
}

interface ChatBody {
  readonly model?: string;
  readonly messages?: readonly WireMessage[];
  readonly tools?: readonly { readonly function: { readonly name: string } }[];
}

interface Question {
  readonly type: "choice" | "noul" | "score";
  readonly instructions: string;
  readonly criteria?: Readonly<Record<string, unknown>> | readonly string[];
}

interface DecisionBody {
  readonly model?: string;
  readonly state: unknown;
  readonly questions: Readonly<Record<string, Question>>;
}

const textOf = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content))
    return content
      .map((part: unknown) =>
        typeof part === "object" && part !== null && "text" in part
          ? String(part.text)
          : JSON.stringify(part),
      )
      .join("\n");
  return content === undefined || content === null ? "" : JSON.stringify(content);
};

const TEXT_FIELD = /"text":\s*"((?:[^"\\]|\\.)*)"/g;

/** Every `"text": "…"` of a framework-rendered message (a start's input, a finish's output), decoded. */
export function messageTexts(rendered: string): string[] {
  return [...rendered.matchAll(TEXT_FIELD)].map(
    (match) => JSON.parse(`"${match[1] ?? ""}"`) as string,
  );
}

/** The newest `"text": "…"` of a framework-rendered message, else the whole text. */
export function latestMessageText(rendered: string): string {
  return messageTexts(rendered).at(-1) ?? rendered;
}

// ---------------------------------------------------------------------------------------------
// Jev: guardrails, the main router, the job-fit judge
// ---------------------------------------------------------------------------------------------

const INJECTION =
  /ignore (all |your |the )?(previous |prior )?instructions|system prompt|hidden prompt/i;
const PERSONAL_DATA = /[\w.+-]+@[\w-]+\.[\w.]+|\+\d{3}[-\s]?\d{2}[-\s]?\d{3}[-\s]?\d{4}/;

/** P(yes) of a guardrail question: an injection attempt, or personal data in an answer. */
function noulOf(question: Question, state: string): number {
  const checked = state.split(/\n\n/).slice(1).join("\n\n") || state;
  if (/personal data/i.test(question.instructions))
    return PERSONAL_DATA.test(checked) ? 0.96 : 0.02;
  return INJECTION.test(latestMessageText(checked)) ? 0.98 : 0.01;
}

/** The agent for the job seeker's newest message. */
export function routeOf(message: string): string {
  if (/\b(save|shortlist)\b/i.test(message)) return "shortlist-agent";
  if (/\b(resume|cv|brief)\b/i.test(message)) return "profiler-agent";
  return "scout-agent";
}

/**
 * P(fit) of one job, by a fixed rule on the job's own lines (title, department, description):
 * seniority, the backend role and the resume's core stack raise it; a lead role halves it; a role
 * outside engineering is no fit.
 */
export function fitOf(state: string): number {
  const job = state.slice(Math.max(0, state.indexOf("Job:")));
  const title = /Job: ([^\n]*)/.exec(job)?.[1] ?? "";
  if (/\b(sales|designer|recruiter|marketing)\b/i.test(title)) return 0.05;
  let fit = 0.2;
  if (/\bsenior\b/i.test(title)) fit += 0.25;
  if (/\b(backend|software engineer)\b/i.test(title)) fit += 0.2;
  for (const skill of [/typescript/i, /node\.js/i, /kafka/i]) if (skill.test(job)) fit += 0.1;
  if (/\b(lead|manager|head)\b/i.test(title)) fit *= 0.5;
  return Math.round(Math.min(fit, 0.95) * 100) / 100;
}

function answerOf(question: Question, state: string): Record<string, unknown> {
  if (question.type === "noul") return { type: "noul", noul: noulOf(question, state) };
  if (question.type === "score") {
    const levels = Array.isArray(question.criteria) ? question.criteria : [];
    return {
      type: "score",
      score: 0,
      probabilities: { "0": 1 },
      legend: Object.fromEntries(levels.map((level, i) => [String(i), String(level)])),
      confidence: 1,
    };
  }
  const options = Object.keys(question.criteria ?? {});
  if (options.includes("fit") && options.includes("no_fit")) {
    const fit = fitOf(state);
    const choice = fit >= 0.5 ? "fit" : "no_fit";
    const confidence = choice === "fit" ? fit : Math.round((1 - fit) * 100) / 100;
    return { type: "choice", choice, probabilities: { fit, no_fit: 1 - fit }, confidence };
  }
  const routed = routeOf(latestMessageText(state));
  const choice = options.includes(routed) ? routed : (options[0] ?? "");
  return { type: "choice", choice, probabilities: { [choice]: 1 }, confidence: 1 };
}

// ---------------------------------------------------------------------------------------------
// Kimi: the profiler, the scout and the shortlist agent
// ---------------------------------------------------------------------------------------------

type Reply = { readonly content: string } | { readonly tool: string; readonly args: object };

/** The messages of the current turn: everything after the newest user message. */
function currentTurn(messages: readonly WireMessage[]): {
  user: string;
  toolResults: string[];
  history: string;
} {
  const lastUser = messages.map((m) => m.role).lastIndexOf("user");
  return {
    user: latestMessageText(textOf(messages[lastUser]?.content)),
    toolResults: messages
      .slice(lastUser + 1)
      .filter((m) => m.role === "tool")
      .map((m) => textOf(m.content)),
    // earlier turns arrive rendered ("Earlier executions on this thread: … {"text":"…"}"): decoded
    history: messages
      .slice(0, lastUser)
      .flatMap((m) => messageTexts(textOf(m.content)))
      .join("\n"),
  };
}

const lineAfter = (text: string, label: string): string | undefined =>
  new RegExp(`${label}\\s*([^\\n]*)`).exec(text)?.[1]?.trim();

const listOf = (line: string | undefined): string[] =>
  (line ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");

function profiler(turn: ReturnType<typeof currentTurn>): Reply {
  const [result] = turn.toolResults;
  if (result === undefined) {
    const path = /(\S+\.(?:md|pdf|txt))\b/.exec(turn.user)?.[1];
    if (path !== undefined) return { tool: "read-resume-tool", args: { path } };
    return { content: "Send me the path of your resume (.pdf, .md or .txt)." };
  }
  const resume = (JSON.parse(result) as { text?: string }).text ?? "";
  const summary = /## Summary\s*\n+([^\n]+)/.exec(resume)?.[1]?.trim() ?? "Engineer.";
  const skills = listOf(
    /## Skills\s*\n+([\s\S]*?)(?:\n#|$)/.exec(resume)?.[1]?.replace(/\n/g, " "),
  );
  return {
    content: [
      `Profile: ${summary}`,
      `Skills: ${skills.slice(0, 12).join(", ")}`,
      "",
      "Proposed search brief:",
      "- Where: Israel",
      "- Roles and specialization: senior backend engineer — TypeScript / Node.js or Java, event-driven systems, LLM agents",
      "- Deal-breakers: none",
      "- Count: 5; Boards: fireblocks, similarweb, jfrog, taboola",
      'Reply "ok" to search, or say what to change.',
    ].join("\n"),
  };
}

interface FoundJob {
  readonly company: string;
  readonly title: string;
  readonly location: string;
  readonly url: string;
  readonly fit: number;
  readonly matchedSkills: readonly string[];
}

function scout(turn: ReturnType<typeof currentTurn>): Reply {
  const [result] = turn.toolResults;
  if (result === undefined) {
    const counted = /Count:\s*(\d+)/.exec(turn.history)?.[1];
    return {
      tool: "greenhouse-jobs-tool",
      args: {
        profile: `Senior backend engineer: ${lineAfter(turn.history, "- Roles and specialization:") ?? "backend"}`,
        locations: [lineAfter(turn.history, "- Where:")?.toLowerCase() ?? "israel"],
        skills: listOf(lineAfter(turn.history, "Skills:")),
        boards: listOf(lineAfter(turn.history, "Boards:")),
        count: counted === undefined ? 20 : Number(counted),
      },
    };
  }
  const matches = JSON.parse(result) as {
    jobs: FoundJob[];
    failedBoards: { board: string; error: string }[];
    passed: number;
  };
  const lines = matches.jobs.map(
    (job, i) =>
      `${String(i + 1)}. **${job.title}** — ${job.company}, ${job.location} — fit ${String(job.fit)}% — ${job.matchedSkills.join(", ") || "no listed skills"} — ${job.url}`,
  );
  const failed = matches.failedBoards.map((board) => `${board.board} (${board.error})`);
  return {
    content: [
      ...lines,
      "",
      `Why the top matches: ${matches.jobs[0]?.company ?? "—"} and ${matches.jobs[1]?.company ?? "—"} ask for the stack your resume leads with.`,
      ...(failed.length > 0 ? [`Boards that could not be read: ${failed.join("; ")}.`] : []),
    ].join("\n"),
  };
}

const LISTED = /^(\d+)\. \*\*(.+?)\*\* — ([^,]+), (.+?) — fit (\d+)% — .* — (\S+)$/gm;

function shortlist(turn: ReturnType<typeof currentTurn>): Reply {
  const [result] = turn.toolResults;
  if (result === undefined) {
    const listed = [...turn.history.matchAll(LISTED)].map((m) => ({
      number: Number(m[1]),
      title: m[2] ?? "",
      company: m[3] ?? "",
      location: m[4] ?? "",
      fit: Number(m[5]),
      link: m[6] ?? "",
    }));
    const wanted = new Set([...turn.user.matchAll(/\d+/g)].map((m) => Number(m[0])));
    const jobs = listed
      .filter((job) => wanted.has(job.number))
      .map((job) => ({
        title: job.title,
        company: job.company,
        location: job.location,
        fit: job.fit,
        link: job.link,
      }));
    if (jobs.length === 0) return { content: "Which jobs? Name their numbers in the list." };
    return { tool: "save-shortlist-tool", args: { jobs } };
  }
  const saved = JSON.parse(result) as { added?: string[]; alreadyThere?: string[] };
  if (saved.added === undefined) return { content: "Nothing was saved." };
  return {
    content: `Added to your shortlist: ${saved.added.join("; ") || "nothing new"}.${
      (saved.alreadyThere ?? []).length > 0
        ? ` Already there: ${(saved.alreadyThere ?? []).join("; ")}.`
        : ""
    }`,
  };
}

function replyOf(body: ChatBody): { agent: string; reply: Reply } {
  const tools = (body.tools ?? []).map((tool) => tool.function.name);
  const turn = currentTurn(body.messages ?? []);
  if (tools.includes("read-resume-tool")) return { agent: "profiler-agent", reply: profiler(turn) };
  if (tools.includes("greenhouse-jobs-tool")) return { agent: "scout-agent", reply: scout(turn) };
  if (tools.includes("save-shortlist-tool"))
    return { agent: "shortlist-agent", reply: shortlist(turn) };
  return { agent: "compaction", reply: { content: "Summary: the job seeker searched for jobs." } };
}

let callIds = 0;

function completion(body: ChatBody, reply: Reply, costUsd: number): Response {
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
    model: body.model ?? CHAT_MODEL,
    provider: "offline-fixture",
    choices: [{ index: 0, message, finish_reason: "content" in reply ? "stop" : "tool_calls" }],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
      cost: costUsd,
    },
  });
}

const urlOf = (input: Parameters<typeof fetch>[0]): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

/** A scripted OpenRouter: `/models`, `/chat/completions` and `/alpha/decisions`, nothing else. */
export function createOfflineOpenRouter(options: OfflineOpenRouterOptions = {}): OfflineOpenRouter {
  const chatCostUsd = options.chatCostUsd ?? 0.0015;
  const decisionCostUsd = options.decisionCostUsd ?? 0.000004;
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
              supported_parameters: ["temperature", "max_tokens", "reasoning", "tools"],
              pricing: { prompt: "0.0000006", completion: "0.0000025" },
            },
          ],
        }),
      );
    }
    if (url.endsWith("/alpha/decisions")) {
      const decision = body as DecisionBody;
      const state =
        typeof decision.state === "string" ? decision.state : JSON.stringify(decision.state);
      const answers = Object.fromEntries(
        Object.entries(decision.questions).map(([id, question]) => [id, answerOf(question, state)]),
      );
      calls.push({ kind: "decision", about: Object.keys(decision.questions).join(",") });
      return Promise.resolve(
        Response.json({
          model: decision.model,
          answers,
          usage: {
            input_tokens: Math.round(state.length / 4),
            output_tokens: 1,
            cost: decisionCostUsd,
          },
        }),
      );
    }
    if (url.endsWith("/chat/completions")) {
      const chat = body as ChatBody;
      const { agent, reply } = replyOf(chat);
      calls.push({ kind: "chat", about: agent });
      return Promise.resolve(completion(chat, reply, chatCostUsd));
    }
    return Promise.resolve(new Response(`offline OpenRouter has no ${url}`, { status: 404 }));
  }) as typeof fetch;
  return { fetch: offlineFetch, calls };
}
