/**
 * Shared offline transport handlers used by deterministic example demos and fault-injection suites
 * so `src/model-providers/*.model-provider.ts` in each example stays a concise declarative
 * `@ModelProvider({...})` configuration class.
 *
 * Uses structural TypeScript types so root `npm run typecheck` compiles `scripts/tooling/`
 * without requiring `agboss` in the root `node_modules` (Rule R2 & R3).
 */

export interface OfflineTransportMessage {
  readonly role: "system" | "user" | "assistant" | "tool";
  readonly text: string;
}

export interface OfflineTransportToolDef {
  readonly name: string;
  readonly description: string;
  readonly schema?: Readonly<Record<string, unknown>>;
}

export interface OfflineTransportToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

export interface OfflineTransportRequest {
  readonly model: string;
  readonly messages: readonly OfflineTransportMessage[];
  readonly tools: readonly OfflineTransportToolDef[];
}

export type OfflineUsd = never;

export interface OfflineTransportResponse {
  readonly text: string;
  readonly toolCalls?: readonly OfflineTransportToolCall[];
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  };
  readonly cost?: OfflineUsd;
}

const usdBrand = (amount: number): OfflineUsd => amount as unknown as OfflineUsd;

/**
 * Determines whether the caller explicitly requested live model execution via `--live`
 * or `AGBOSS_LIVE_DEMO=true`. Offline mode is always the default for `npm run demo`.
 */
export function isLiveDemoRequested(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return argv.includes("--live") || env.AGBOSS_LIVE_DEMO === "true";
}

/**
 * Validates that a real OpenRouter credential is present when live demo mode is requested.
 */
export function requireLiveApiKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = (env.OPENROUTER_API_KEY ?? env.OPEN_ROUTER_KEY ?? "").trim();
  if (!key || key === "offline-test-openrouter-api-key") {
    throw new Error(
      "Live demo mode (--live or AGBOSS_LIVE_DEMO=true) requires a valid OPENROUTER_API_KEY environment variable.",
    );
  }
  return key;
}

/**
 * Intercepts global `fetch` during offline demos so any accidental call to a non-loopback host
 * (such as `https://openrouter.ai`) fails immediately instead of silently attempting a network call.
 */
export function installOfflineNetworkGuard(): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const rawUrl =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const parsed = new URL(rawUrl);
    const isLoopback =
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "::1" ||
      parsed.hostname === "[::1]";
    if (!isLoopback) {
      throw new Error(
        `Offline demo blocked external network request to ${parsed.origin}${parsed.pathname}. Use --live (or AGBOSS_LIVE_DEMO=true) with OPENROUTER_API_KEY for live model calls.`,
      );
    }
    return originalFetch(input, init);
  };
  return () => {
    globalThis.fetch = originalFetch;
  };
}

/**
 * Stub `providerFetch` for `01-hello-agboss` when running `npm run demo` offline without
 * `OPENROUTER_API_KEY`, exercising the real `OpenRouterChatModelProvider` HTTP wire pipeline.
 */
export function createHelloOfflineFetch(): typeof fetch {
  return async (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (url.endsWith("/models")) {
      return Response.json({
        data: [
          {
            id: "moonshotai/kimi-k2.6",
            supported_parameters: ["temperature", "max_tokens", "reasoning"],
            pricing: {
              prompt: "0.0000001",
              completion: "0.0000002",
              input_cache_read: "0.00000005",
            },
          },
          {
            id: "openai/gpt-4o-mini",
            supported_parameters: ["temperature", "max_tokens", "reasoning"],
            pricing: {
              prompt: "0.00000015",
              completion: "0.0000006",
            },
          },
        ],
      });
    }

    const rawBody = typeof init?.body === "string" ? init.body : "{}";
    const parsed = JSON.parse(rawBody) as {
      model?: string;
      messages?: { role: string; content: unknown }[];
      tools?: { function: { name: string } }[];
    };
    const messages = parsed.messages ?? [];
    const tools = parsed.tools ?? [];

    const textOf = (content: unknown): string => {
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content
          .map((part) =>
            typeof part === "object" && part !== null && "text" in part
              ? String((part as { text: unknown }).text)
              : JSON.stringify(part),
          )
          .join("\n");
      }
      return JSON.stringify(content ?? "");
    };

    const userOnlyText = messages
      .filter((m) => m.role === "user")
      .map((m) => textOf(m.content))
      .join("\n");

    // 1. Router call (no tools bound)
    if (tools.length === 0) {
      const isPricing = /"question"\s*:\s*"[^"]*(?:pricing|price|quote)/i.test(userOnlyText);
      const next = isPricing ? "quote-advisor-agent" : "support-specialist-agent";
      return Response.json({
        id: "chatcmpl-router-1",
        object: "chat.completion",
        created: 1_700_000_000,
        model: parsed.model ?? "moonshotai/kimi-k2.6",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify({
                next,
                reason: isPricing
                  ? "Customer requested pricing quote"
                  : "General product inquiry",
              }),
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: 48,
          completion_tokens: 16,
          total_tokens: 64,
          cost: 0.00001,
        },
      });
    }

    const calcTool = tools.find((t) => t.function.name === "calculate-quote-tool");
    const answerTool = tools.find((t) => t.function.name.startsWith("answer"));
    const toolResultMsg = [...messages].reverse().find((m) => m.role === "tool");

    // 2. First turn of QuoteAdvisorAgent: invoke calculate-quote-tool
    if (calcTool !== undefined && toolResultMsg === undefined) {
      const seatsMatch = /"seats"\s*:\s*(\d+)/.exec(userOnlyText);
      const seats = seatsMatch ? Number(seatsMatch[1]) : 12;
      const tier = /enterprise/i.test(userOnlyText)
        ? "enterprise"
        : /starter/i.test(userOnlyText)
          ? "starter"
          : "pro";

      return Response.json({
        id: "chatcmpl-quote-tool-1",
        object: "chat.completion",
        created: 1_700_000_001,
        model: parsed.model ?? "openai/gpt-4o-mini",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "call-quote-1",
                  type: "function",
                  function: {
                    name: calcTool.function.name,
                    arguments: JSON.stringify({ tier, seats }),
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: {
          prompt_tokens: 64,
          completion_tokens: 24,
          total_tokens: 88,
          cost: 0.00002,
        },
      });
    }

    // 3. Second turn of QuoteAdvisorAgent: read tool output and call answer tool
    if (calcTool !== undefined && toolResultMsg !== undefined && answerTool !== undefined) {
      const parsedTool = JSON.parse(textOf(toolResultMsg.content)) as {
        tier: string;
        seats: number;
        monthlyTotalUsd: number;
        volumeDiscountApplied: boolean;
        currency: string;
      };
      return Response.json({
        id: "chatcmpl-quote-ans-1",
        object: "chat.completion",
        created: 1_700_000_002,
        model: parsed.model ?? "openai/gpt-4o-mini",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "call-answer-quote",
                  type: "function",
                  function: {
                    name: answerTool.function.name,
                    arguments: JSON.stringify({
                      handledBy: "pricing",
                      answer: `Quote for ${String(parsedTool.seats)} seats on ${parsedTool.tier} tier: $${String(parsedTool.monthlyTotalUsd)}/mo (${parsedTool.currency}, volume discount: ${String(parsedTool.volumeDiscountApplied)}).`,
                      quotedMonthlyUsd: parsedTool.monthlyTotalUsd,
                    }),
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: {
          prompt_tokens: 92,
          completion_tokens: 36,
          total_tokens: 128,
          cost: 0.00003,
        },
      });
    }

    // 4. SupportSpecialistAgent: call answer tool directly
    if (answerTool !== undefined) {
      return Response.json({
        id: "chatcmpl-support-ans-1",
        object: "chat.completion",
        created: 1_700_000_003,
        model: parsed.model ?? "moonshotai/kimi-k2.6",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "call-answer-support",
                  type: "function",
                  function: {
                    name: answerTool.function.name,
                    arguments: JSON.stringify({
                      handledBy: "support",
                      answer:
                        "AGBoss enforces compile-time and static Path Scope guarantees before any workflow executes.",
                      quotedMonthlyUsd: 0,
                    }),
                  },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
        usage: {
          prompt_tokens: 52,
          completion_tokens: 28,
          total_tokens: 80,
          cost: 0.00001,
        },
      });
    }

    return Response.json({
      id: "chatcmpl-fallback",
      object: "chat.completion",
      created: 1_700_000_004,
      model: parsed.model ?? "moonshotai/kimi-k2.6",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Completed." },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.00001 },
    });
  };
}

/** 02-path-scope-proof & 06-enterprise-agent-mesh no-op transport base class. */
export abstract class OfflineNoopTransport {
  complete(_request: OfflineTransportRequest): Promise<OfflineTransportResponse> {
    return Promise.resolve({
      text: "{}",
      toolCalls: [],
      usage: { inputTokens: 0, outputTokens: 0 },
    });
  }
}

/** 03-support-refund-desk deterministic transport & fault-injection state. */
export interface SupportModelConfig {
  readonly simulateAttemptOverCap?: boolean;
  readonly simulateUnverifiedPromise?: boolean;
  readonly simulateMissingCitationOnce?: boolean;
  readonly simulateFlakyRunNumbers?: readonly number[];
}

let supportModelConfig: SupportModelConfig = {};
let supportExecutionCallCounter = 0;
const recordedSupportModelRequests: OfflineTransportRequest[] = [];

export function configureSupportModel(config: SupportModelConfig): void {
  supportModelConfig = { ...config };
  supportExecutionCallCounter = 0;
}

export function resetSupportModel(): void {
  supportModelConfig = {};
  supportExecutionCallCounter = 0;
  recordedSupportModelRequests.length = 0;
}

export function getRecordedModelRequests(): readonly OfflineTransportRequest[] {
  return [...recordedSupportModelRequests];
}

function extractOrderId(text: string): string {
  const match = /ORD-\d{4}/u.exec(text);
  return match ? match[0] : "ORD-1001";
}

function extractEmailOrToken(text: string): string {
  const tokenMatch = /<email:[0-9a-f]+>/u.exec(text);
  if (tokenMatch) return tokenMatch[0];
  const emailMatch = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/u.exec(text);
  return emailMatch ? emailMatch[0] : "alice.synth@example.com";
}

export abstract class SupportOfflineTransport {
  complete(request: OfflineTransportRequest): Promise<OfflineTransportResponse> {
    recordedSupportModelRequests.push(request);
    const combinedText = request.messages.map((m) => m.text).join("\n");

    const guardrailTool = request.tools.find((t) => t.name.includes("guardrail"));
    if (guardrailTool !== undefined) {
      const shouldBlock =
        combinedText.toLowerCase().includes("legal settlement") ||
        combinedText.toLowerCase().includes("punitive damages");
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_guardrail_1",
            name: guardrailTool.name,
            arguments: { blocks: shouldBlock },
          },
        ],
        usage: { inputTokens: 15, outputTokens: 5 },
        cost: usdBrand(0.0001),
      });
    }

    if (request.model === "delegate/judge-chat") {
      const hasUnverifiedFee = combinedText.toLowerCase().includes("restocking fee");
      return Promise.resolve({
        text: hasUnverifiedFee
          ? "FAILED: Explanation invents an unverified restocking fee not in v2.0 policy."
          : "PASSED: Decision and explanation are grounded in the order record and v2.0 policy.",
        usage: { inputTokens: 25, outputTokens: 12 },
        cost: usdBrand(0.0001),
      });
    }

    if (request.tools.length === 0) {
      const orderId = extractOrderId(combinedText);
      return Promise.resolve({
        text: `Summary: Customer inquired about order ${orderId}; note that legacy v1.0 policy is superseded by active v2.0 (30-day window, $500 cap).`,
        usage: { inputTokens: 30, outputTokens: 20 },
        cost: usdBrand(0.0001),
      });
    }

    const answerTool =
      request.tools.find((t) => t.name.startsWith("answer-"))?.name ?? "answer-support-answer-dto";
    const toolMessages = request.messages.filter((m) => m.role === "tool");
    const orderId = extractOrderId(combinedText);
    const customerEmail = extractEmailOrToken(combinedText);

    if (toolMessages.length === 0) {
      supportExecutionCallCounter += 1;
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: `call_lookup_${supportExecutionCallCounter}`,
            name: "lookup-order-tool",
            arguments: { orderId, customerEmail },
          },
        ],
        usage: { inputTokens: 40, outputTokens: 15 },
        cost: usdBrand(0.0001),
      });
    }

    if (toolMessages.length === 1) {
      const lookupText = toolMessages[0]?.text ?? "{}";
      if (lookupText.includes("Policy rejection") || lookupText.includes("Tool error")) {
        return Promise.resolve({
          text: "",
          toolCalls: [
            {
              id: "call_ans_err",
              name: answerTool,
              arguments: {
                decision: "denied",
                orderId,
                refundedUsd: 0,
                explanation: `Unable to process order ${orderId}: ${lookupText} [policy].`,
              },
            },
          ],
          usage: { inputTokens: 45, outputTokens: 20 },
          cost: usdBrand(0.0001),
        });
      }

      let parsedOrder: {
        orderId?: string;
        amountUsd?: number;
        daysSincePurchase?: number;
        eligibleByWindow?: boolean;
      } = {};
      try {
        parsedOrder = JSON.parse(lookupText) as typeof parsedOrder;
      } catch {
        parsedOrder = { orderId, amountUsd: 180, daysSincePurchase: 12, eligibleByWindow: true };
      }

      const amountUsd = parsedOrder.amountUsd ?? 180;
      const eligibleByWindow = parsedOrder.eligibleByWindow ?? true;

      if (supportModelConfig.simulateUnverifiedPromise === true) {
        return Promise.resolve({
          text: "",
          toolCalls: [
            {
              id: "call_ans_promise",
              name: answerTool,
              arguments: {
                decision: "approved",
                orderId,
                refundedUsd: amountUsd,
                explanation:
                  "We also promise a $10,000 legal settlement and punitive damages for your trouble [policy].",
              },
            },
          ],
          usage: { inputTokens: 45, outputTokens: 25 },
          cost: usdBrand(0.0001),
        });
      }

      if (
        supportModelConfig.simulateAttemptOverCap === true ||
        combinedText.includes("force-instant-refund")
      ) {
        return Promise.resolve({
          text: "",
          toolCalls: [
            {
              id: "call_refund_attempt",
              name: "issue-refund-tool",
              arguments: {
                orderId,
                customerEmail,
                amountUsd,
                reason: "Customer requested immediate full refund",
              },
            },
          ],
          usage: { inputTokens: 50, outputTokens: 20 },
          cost: usdBrand(0.0001),
        });
      }

      if (!eligibleByWindow) {
        const feeNote =
          process.env.AGBOSS_SIMULATE_FLAKY_EVAL === "1" && supportExecutionCallCounter % 2 === 0
            ? " (subject to a $15 restocking fee)"
            : "";
        return Promise.resolve({
          text: "",
          toolCalls: [
            {
              id: "call_ans_denied_window",
              name: answerTool,
              arguments: {
                decision: "denied",
                orderId,
                refundedUsd: 0,
                explanation: `Order ${orderId} was purchased ${parsedOrder.daysSincePurchase ?? 45} days ago, which is outside the active 30-day window${feeNote} [policy].`,
              },
            },
          ],
          usage: { inputTokens: 50, outputTokens: 25 },
          cost: usdBrand(0.0001),
        });
      }

      if (amountUsd > 500) {
        return Promise.resolve({
          text: "",
          toolCalls: [
            {
              id: "call_ans_escalated",
              name: answerTool,
              arguments: {
                decision: "escalated",
                orderId,
                refundedUsd: 0,
                explanation: `Order ${orderId} ($${amountUsd}) exceeds the $500 self-service cap and has been escalated for supervisor review [policy].`,
              },
            },
          ],
          usage: { inputTokens: 50, outputTokens: 25 },
          cost: usdBrand(0.0001),
        });
      }

      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_issue_refund",
            name: "issue-refund-tool",
            arguments: {
              orderId,
              customerEmail,
              amountUsd,
              reason: "Eligible self-service refund within 30-day window and $500 cap",
            },
          },
        ],
        usage: { inputTokens: 50, outputTokens: 20 },
        cost: usdBrand(0.0001),
      });
    }

    const lastToolText = toolMessages.at(-1)?.text ?? "";
    if (lastToolText.includes("Policy rejection [policy-cap]")) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_ans_intercepted_cap",
            name: answerTool,
            arguments: {
              decision: "escalated",
              orderId,
              refundedUsd: 0,
              explanation: `Escalated to supervisor because the requested refund exceeds the $500 self-service cap [policy].`,
            },
          },
        ],
        usage: { inputTokens: 60, outputTokens: 25 },
        cost: usdBrand(0.0001),
      });
    }

    if (lastToolText.includes("Policy rejection [policy-window]")) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_ans_intercepted_window",
            name: answerTool,
            arguments: {
              decision: "denied",
              orderId,
              refundedUsd: 0,
              explanation: `Denied because order ${orderId} is outside the active 30-day refund window [policy].`,
            },
          },
        ],
        usage: { inputTokens: 60, outputTokens: 25 },
        cost: usdBrand(0.0001),
      });
    }

    let refundedUsd = 180;
    try {
      const receipt = JSON.parse(lastToolText) as { refundedUsd?: number };
      if (typeof receipt.refundedUsd === "number") refundedUsd = receipt.refundedUsd;
    } catch {
      refundedUsd = 180;
    }

    const isFlakyMiss =
      supportModelConfig.simulateFlakyRunNumbers?.includes(supportExecutionCallCounter) === true &&
      !combinedText.includes("cite a [policy]") &&
      !combinedText.includes("Explanation must cite");

    const citationSuffix = isFlakyMiss ? "" : " [policy]";

    return Promise.resolve({
      text: "",
      toolCalls: [
        {
          id: "call_ans_approved",
          name: answerTool,
          arguments: {
            decision: "approved",
            orderId,
            refundedUsd,
            explanation: `Refund of $${refundedUsd} for order ${orderId} has been approved and processed under the 30-day / $500 policy${citationSuffix}.`,
          },
        },
      ],
      usage: { inputTokens: 60, outputTokens: 25 },
      cost: usdBrand(0.0001),
    });
  }
}

/** 04-travel-booking-saga deterministic transport. */
export abstract class SagaOfflineTransport {
  protected waitForChannelAsk?(): Promise<void>;

  async complete(request: OfflineTransportRequest): Promise<OfflineTransportResponse> {
    const systemText = request.messages
      .filter((m) => m.role === "system")
      .map((m) => m.text)
      .join("\n");
    const userText = request.messages
      .filter((m) => m.role === "user")
      .map((m) => m.text)
      .join("\n");

    const bookingMatch = /"bookingId"\s*:\s*"([^"]+)"/.exec(userText);
    const bookingId = bookingMatch?.[1] ?? "BK-UNKNOWN";
    const amountMatch = /"totalAmountUsd"\s*:\s*([0-9.]+)/.exec(userText);
    const amountUsd = amountMatch ? Number(amountMatch[1]) : 1500;

    const approvalTool = request.tools.find((t) => t.name === "request-manager-approval-tool");
    const answerTool = request.tools.find((t) => t.name.startsWith("answer"));
    const toolResultMsg = [...request.messages].reverse().find((m) => m.role === "tool");

    if (systemText.includes("Itinerary Brief Agent") && answerTool !== undefined) {
      const isExceed = bookingId.startsWith("BUDGET-EXCEED-");
      if (isExceed && request.messages.length <= 2) {
        return {
          text: "Drafting executive itinerary...",
          usage: { inputTokens: 500_000, outputTokens: 500_000 },
        };
      }
      return {
        text: "",
        toolCalls: [
          {
            id: `call-brief-${bookingId}`,
            name: answerTool.name,
            arguments: { brief: `Executive itinerary prepared for ${bookingId}` },
          },
        ],
        usage: { inputTokens: 100, outputTokens: 50 },
      };
    }

    if (systemText.includes("Manager Approval Coordinator Agent")) {
      if (approvalTool !== undefined && toolResultMsg === undefined) {
        return {
          text: "",
          toolCalls: [
            {
              id: `call-hold-${bookingId}`,
              name: approvalTool.name,
              arguments: { bookingId, amountUsd },
            },
          ],
          usage: { inputTokens: 60, outputTokens: 20 },
        };
      }
      if (toolResultMsg !== undefined && answerTool !== undefined) {
        const parsed = JSON.parse(toolResultMsg.text) as {
          approvalToken: string;
          approved: boolean;
        };
        return {
          text: "",
          toolCalls: [
            {
              id: `call-hold-ans-${bookingId}`,
              name: answerTool.name,
              arguments: { approvalToken: parsed.approvalToken, approved: parsed.approved },
            },
          ],
          usage: { inputTokens: 80, outputTokens: 25 },
        };
      }
    }

    if (systemText.includes("Finance Reviewer Agent") && answerTool !== undefined) {
      if (bookingId.startsWith("WITHDRAW-") && this.waitForChannelAsk) {
        await this.waitForChannelAsk();
      }
      return {
        text: "",
        toolCalls: [
          {
            id: `call-fin-${bookingId}`,
            name: answerTool.name,
            arguments: {
              department: "finance",
              approved: true,
              confidenceScore: 95,
              rationale: "Within Q4 travel budget allocation",
            },
          },
        ],
        usage: { inputTokens: 50, outputTokens: 20 },
      };
    }

    if (systemText.includes("Compliance Reviewer Agent") && answerTool !== undefined) {
      if (bookingId.startsWith("WITHDRAW-") && this.waitForChannelAsk) {
        await this.waitForChannelAsk();
      }
      return {
        text: "",
        toolCalls: [
          {
            id: `call-comp-${bookingId}`,
            name: answerTool.name,
            arguments: {
              department: "compliance",
              approved: true,
              confidenceScore: 92,
              rationale: "Preferred airline and hotel tier verified",
            },
          },
        ],
        usage: { inputTokens: 50, outputTokens: 20 },
      };
    }

    if (systemText.includes("Risk Reviewer Agent")) {
      if (
        bookingId.startsWith("WITHDRAW-") &&
        approvalTool !== undefined &&
        toolResultMsg === undefined
      ) {
        return {
          text: "",
          toolCalls: [
            {
              id: `call-risk-pause-${bookingId}`,
              name: approvalTool.name,
              arguments: { bookingId, amountUsd },
            },
          ],
          usage: { inputTokens: 50, outputTokens: 20 },
        };
      }

      if (answerTool !== undefined) {
        return {
          text: "",
          toolCalls: [
            {
              id: `call-risk-${bookingId}`,
              name: answerTool.name,
              arguments: {
                department: "risk",
                approved: false,
                confidenceScore: 45,
                rationale: "Requires secondary manual check",
              },
            },
          ],
          usage: { inputTokens: 50, outputTokens: 20 },
        };
      }
    }

    return {
      text: "Completed",
      usage: { inputTokens: 10, outputTokens: 5 },
    };
  }
}

/** 05-cluster-work-stealing deterministic transport. */
export abstract class ClusterOfflineTransport {
  complete(request: OfflineTransportRequest): Promise<OfflineTransportResponse> {
    const toolNames = request.tools.map((t) => t.name);
    const userMessage = request.messages.find((m) => m.role === "user")?.text ?? "";

    if (toolNames.includes("answer-decompose-split-decision-dto")) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_split_1",
            name: "answer-decompose-split-decision-dto",
            arguments: { reason: "Root shard exceeds single-worker threshold" },
          },
        ],
        usage: { inputTokens: 20, outputTokens: 10 },
        cost: usdBrand(0.0001),
      });
    }

    if (toolNames.includes("answer-decomposed-leaf-dto")) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_leaf_1",
            name: "answer-decomposed-leaf-dto",
            arguments: { report: "Leaf shard completed offline" },
          },
        ],
        usage: { inputTokens: 20, outputTokens: 10 },
        cost: usdBrand(0.0001),
      });
    }

    const answerTool =
      request.tools.find((t) => t.name.startsWith("answer-"))?.name ?? "answer-chunk-draft-dto";
    const chunkMatch = /"chunkId"\s*:\s*"([^"]+)"/u.exec(userMessage);
    const chunkId = chunkMatch?.[1] ?? "chunk-1";

    return Promise.resolve({
      text: "",
      toolCalls: [
        {
          id: `call_${chunkId}`,
          name: answerTool,
          arguments: { chunkId, summary: `Processed ${chunkId}` },
        },
      ],
      usage: { inputTokens: 20, outputTokens: 10 },
      cost: usdBrand(0.0001),
    });
  }
}

/** 06-enterprise-agent-mesh TriageAgent deterministic transport. */
export abstract class TriageOfflineTransport {
  complete(request: OfflineTransportRequest): Promise<OfflineTransportResponse> {
    const answerTool =
      request.tools.find((t) => t.name.startsWith("answer-"))?.name ?? "answer-triage-response-dto";
    const toolMessages = request.messages.filter((m) => m.role === "tool");

    if (toolMessages.length === 0) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_catalog_1",
            name: "search-catalog-tool",
            arguments: { sku: "SKU-GPU-900" },
          },
        ],
        usage: { inputTokens: 30, outputTokens: 12 },
        cost: usdBrand(0.0001),
      });
    }

    if (toolMessages.length === 1) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_billing_1",
            name: "ask-billing-tool",
            arguments: {
              invoiceId: "INV-5001",
              question: "Verify SLA credit for delayed GPU rack delivery",
            },
          },
        ],
        usage: { inputTokens: 40, outputTokens: 15 },
        cost: usdBrand(0.0001),
      });
    }

    return Promise.resolve({
      text: "",
      toolCalls: [
        {
          id: "call_triage_answer",
          name: answerTool,
          arguments: {
            invoiceId: "INV-5001",
            sku: "SKU-GPU-900",
            summary:
              "SKU-GPU-900 verified in catalog (14 units) and invoice INV-5001 credited $45.00 by billing-application.",
            creditedUsd: 45,
          },
        },
      ],
      usage: { inputTokens: 50, outputTokens: 20 },
      cost: usdBrand(0.0001),
    });
  }
}

/** 07-langgraph-migration deterministic transport. */
export abstract class MigrationOfflineTransport {
  complete(request: OfflineTransportRequest): Promise<OfflineTransportResponse> {
    if (request.tools.length === 0) {
      return Promise.resolve({
        text: JSON.stringify({
          next: "research-planner-agent",
          reason: "Customer requested a refund for a delayed order",
        }),
        usage: { inputTokens: 20, outputTokens: 10 },
        cost: usdBrand(0.0001),
      });
    }

    const toolNames = request.tools.map((t) => t.name);
    if (toolNames.includes("answer-research-question-dto")) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_plan_1",
            name: "answer-research-question-dto",
            arguments: {
              items: [{ question: "Was the order delivered late?" }],
            },
          },
        ],
        usage: { inputTokens: 25, outputTokens: 12 },
        cost: usdBrand(0.0001),
      });
    }

    if (toolNames.includes("answer-research-finding-dto")) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_research_1",
            name: "answer-research-finding-dto",
            arguments: {
              question: "Was the order delivered late?",
              answer: "Yes, delivered four days late",
            },
          },
        ],
        usage: { inputTokens: 30, outputTokens: 14 },
        cost: usdBrand(0.0001),
      });
    }

    if (toolNames.includes("answer-reply-draft-dto")) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_draft_1",
            name: "answer-reply-draft-dto",
            arguments: {
              text: "Four days late — sorry, refund of $15 is on its way.",
              refundCents: 1_500,
            },
          },
        ],
        usage: { inputTokens: 35, outputTokens: 16 },
        cost: usdBrand(0.0001),
      });
    }

    if (toolNames.includes("answer-reply-approved-dto")) {
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: "call_review_1",
            name: "answer-reply-approved-dto",
            arguments: {},
          },
        ],
        usage: { inputTokens: 30, outputTokens: 10 },
        cost: usdBrand(0.0001),
      });
    }

    const answerTool = request.tools[0]?.name ?? "answer";
    return Promise.resolve({
      text: "",
      toolCalls: [
        {
          id: "call_offline_1",
          name: answerTool,
          arguments: {},
        },
      ],
      usage: { inputTokens: 20, outputTokens: 10 },
      cost: usdBrand(0.0001),
    });
  }
}
