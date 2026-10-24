import {
  Application,
  Budget,
  BudgetPeriod,
  BudgetScope,
  SqliteCheckpointSaver,
  SqliteCostLedgerRepository,
  SqliteExecutionHistoryRepository,
  SqliteExecutionLeaseRepository,
  SqliteExecutionRecordRepository,
  SqliteExecutionTreeRepository,
  SqlitePausedExecutionRepository,
  SqliteRateLimitRepository,
  type BudgetHandler,
} from "agboss";
import {
  ModelCost,
  ModelProvider,
  RetryPolicy,
  type ModelProviderHandler,
  type ModelProviderRequest,
  type ModelProviderResponse,
} from "agboss/models";
import { hours, minutes, seconds, usd, type Usd } from "agboss/units";
import { AppEnvironment } from "./environments/app.environment.js";
import { AuditTrailToolInterceptor } from "./interceptors/audit.interceptor.js";
import { CustomerContactPiiPolicy } from "./policies/customer-pii.policy.js";
import {
  SupportExecutionContext,
  SupportTenantContext,
} from "./workflows/dtos.js";
import { SupportRefundWorkflow } from "./workflows/support-refund.workflow.js";

export interface SupportModelConfig {
  readonly simulateAttemptOverCap?: boolean;
  readonly simulateUnverifiedPromise?: boolean;
  readonly simulateMissingCitationOnce?: boolean;
  readonly simulateFlakyRunNumbers?: readonly number[];
}

let modelConfig: SupportModelConfig = {};
let executionCallCounter = 0;
const recordedModelRequests: ModelProviderRequest[] = [];

export function configureSupportModel(config: SupportModelConfig): void {
  modelConfig = { ...config };
  executionCallCounter = 0;
}

export function resetSupportModel(): void {
  modelConfig = {};
  executionCallCounter = 0;
  recordedModelRequests.length = 0;
}

export function getRecordedModelRequests(): readonly ModelProviderRequest[] {
  return [...recordedModelRequests];
}

function extractOrderId(text: string): string {
  const match = /ORD-\d{4}/u.exec(text);
  return match ? match[0] : "ORD-1001";
}

function extractEmailOrToken(text: string): string {
  const tokenMatch = /<email:[0-9a-f]+>/u.exec(text);
  if (tokenMatch) {
    return tokenMatch[0];
  }
  const emailMatch = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/u.exec(text);
  return emailMatch ? emailMatch[0] : "alice.synth@example.com";
}

@ModelProvider({
  name: "support-offline-model-provider",
  description: "Deterministic offline model provider for support-refund-desk scenarios and eval suites.",
  serves: [/^(?:offline|delegate)\//u],
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  retryPolicy: RetryPolicy.none(),
  circuitBreakerPolicy: {
    failureThreshold: 10,
    window: minutes(1),
    openFor: seconds(10),
  },
})
export class SupportOfflineModelProvider implements ModelProviderHandler {
  complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    recordedModelRequests.push(request);
    const combinedText = request.messages.map((m) => m.text).join("\n");

    // 1. Model guardrail check (has a tool with `guardrail` in its name)
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
        cost: usd(0.0001),
      });
    }

    // 2. Model judge check (`delegate/judge-chat`)
    if (request.model === "delegate/judge-chat") {
      const hasUnverifiedFee = combinedText.toLowerCase().includes("restocking fee");
      return Promise.resolve({
        text: hasUnverifiedFee
          ? "FAILED: Explanation invents an unverified restocking fee not in v2.0 policy."
          : "PASSED: Decision and explanation are grounded in the order record and v2.0 policy.",
        usage: { inputTokens: 25, outputTokens: 12 },
        cost: usd(0.0001),
      });
    }

    // 3. Compaction model call (no tools bound)
    if (request.tools.length === 0) {
      const orderId = extractOrderId(combinedText);
      return Promise.resolve({
        text: `Summary: Customer inquired about order ${orderId}; note that legacy v1.0 policy is superseded by active v2.0 (30-day window, $500 cap).`,
        usage: { inputTokens: 30, outputTokens: 20 },
        cost: usd(0.0001),
      });
    }

    // 4. Support Agent tool-calling loop
    const answerTool =
      request.tools.find((t) => t.name.startsWith("answer-"))?.name ??
      "answer-support-answer-dto";
    const toolMessages = request.messages.filter((m) => m.role === "tool");
    const orderId = extractOrderId(combinedText);
    const customerEmail = extractEmailOrToken(combinedText);

    // Step A: First turn of agent visit -> look up the order
    if (toolMessages.length === 0) {
      executionCallCounter += 1;
      return Promise.resolve({
        text: "",
        toolCalls: [
          {
            id: `call_lookup_${executionCallCounter}`,
            name: "lookup-order-tool",
            arguments: {
              orderId,
              customerEmail,
            },
          },
        ],
        usage: { inputTokens: 40, outputTokens: 15 },
        cost: usd(0.0001),
      });
    }

    // Step B: After lookup-order-tool returned
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
          cost: usd(0.0001),
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

      if (modelConfig.simulateUnverifiedPromise === true) {
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
          cost: usd(0.0001),
        });
      }

      // If configured to attempt over-cap tool call (or message asks to force instant refund on ORD-1002),
      // call issue-refund-tool so RefundPolicyToolInterceptor intercepts it with replyToModel!
      if (
        modelConfig.simulateAttemptOverCap === true ||
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
          cost: usd(0.0001),
        });
      }

      if (!eligibleByWindow) {
        const feeNote =
          process.env.AGBOSS_SIMULATE_FLAKY_EVAL === "1" && executionCallCounter % 2 === 0
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
          cost: usd(0.0001),
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
          cost: usd(0.0001),
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
        cost: usd(0.0001),
      });
    }

    // Step C: After issue-refund-tool returned (or was intercepted by RefundPolicyToolInterceptor)
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
        cost: usd(0.0001),
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
        cost: usd(0.0001),
      });
    }

    let refundedUsd = 180;
    try {
      const receipt = JSON.parse(lastToolText) as { refundedUsd?: number };
      if (typeof receipt.refundedUsd === "number") {
        refundedUsd = receipt.refundedUsd;
      }
    } catch {
      refundedUsd = 180;
    }

    const isFlakyMiss =
      modelConfig.simulateFlakyRunNumbers?.includes(executionCallCounter) === true &&
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
      cost: usd(0.0001),
    });
  }
}

@Budget({
  name: "support-app-daily-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class SupportAppDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(50);
  }
}

@Budget({
  name: "support-tenant-daily-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class SupportTenantDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(10);
  }
}

@Budget({
  name: "support-execution-budget",
  scope: BudgetScope.Execution,
})
export class SupportExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(1);
  }
}

@Application({
  name: "support-refund-desk-application",
  version: "1.0.0",
  environment: AppEnvironment,
  tenantContext: SupportTenantContext,
  executionContext: SupportExecutionContext,
  pseudonymKey: "piiPseudonymKey",
  workflows: [SupportRefundWorkflow],
  budgets: [SupportAppDailyBudget, SupportTenantDailyBudget, SupportExecutionBudget],
  piiPolicies: [CustomerContactPiiPolicy],
  toolInterceptors: [AuditTrailToolInterceptor],
  providers: [
    SupportOfflineModelProvider,
    SqliteCheckpointSaver,
    SqliteExecutionRecordRepository,
    SqlitePausedExecutionRepository,
    SqliteCostLedgerRepository,
    SqliteExecutionLeaseRepository,
    SqliteExecutionTreeRepository,
    SqliteRateLimitRepository,
    SqliteExecutionHistoryRepository,
  ],
  executionRecordRetention: hours(24 * 30),
  pauseRecordRetention: hours(24),
  shutdownTimeout: seconds(15),
  defaults: {
    models: { temperature: 0 },
  },
})
export class SupportRefundDeskApplication {}
