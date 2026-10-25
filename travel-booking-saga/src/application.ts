import {
  Application,
  Budget,
  BudgetPeriod,
  BudgetScope,
  type BudgetHandler,
  SqliteCheckpointSaver,
  SqliteCostLedgerRepository,
  SqliteExecutionHistoryRepository,
  SqliteExecutionLeaseRepository,
  SqliteExecutionRecordRepository,
  SqliteExecutionTreeRepository,
  SqlitePausedExecutionRepository,
} from "agboss";
import {
  ModelCost,
  ModelProvider,
  ModelProviderMessageRole,
  OpenRouterModelProvider,
  RetryPolicy,
  TRANSIENT_FAILURES,
  type ModelProviderHandler,
  type ModelProviderRequest,
  type ModelProviderResponse,
} from "agboss/models";
import { minutes, seconds, usd, type Usd } from "agboss/units";
import {
  CorporateBookingApprovalChannel,
  waitForChannelAskSent,
} from "./channels/booking-approval.channel.js";
import { AppEnvironment } from "./environments/app.environment.js";
import {
  BudgetSagaWorkflow,
  HitlHoldSagaWorkflow,
  PaymentSagaWorkflow,
  QuorumSagaWorkflow,
} from "./workflows/travel-booking.workflow.js";

@Budget({
  name: "saga-app-daily-budget",
  scope: BudgetScope.Application,
  period: BudgetPeriod.Day,
})
export class SagaApplicationDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(50);
  }
}

@Budget({
  name: "saga-tenant-daily-budget",
  scope: BudgetScope.Tenant,
  period: BudgetPeriod.Day,
})
export class SagaTenantDailyBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(20);
  }
}

@Budget({
  name: "saga-execution-budget",
  scope: BudgetScope.Execution,
})
export class SagaExecutionBudget implements BudgetHandler {
  maxSpend(): Usd {
    return usd(0.5);
  }
}

@ModelProvider({
  name: "saga-offline-model-provider",
  description: "Deterministic offline transport model provider for travel-booking-saga",
  serves: [/^saga-model$/u],
  timeout: seconds(30),
  cost: ModelCost.fromPrices({
    "saga-model": { inputPerMillion: usd(1), outputPerMillion: usd(2) },
  }),
  retryPolicy: RetryPolicy.exponential({
    maxAttempts: 2,
    initialDelay: seconds(1),
    maxDelay: seconds(5),
    jitter: false,
    retryOn: TRANSIENT_FAILURES,
  }),
  circuitBreakerPolicy: { failureThreshold: 5, window: minutes(1), openFor: seconds(15) },
})
export class SagaOfflineModelProvider implements ModelProviderHandler {
  async complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const systemText = request.messages
      .filter((m) => m.role === ModelProviderMessageRole.System)
      .map((m) => m.text)
      .join("\n");
    const userText = request.messages
      .filter((m) => m.role === ModelProviderMessageRole.User)
      .map((m) => m.text)
      .join("\n");

    const bookingMatch = /"bookingId"\s*:\s*"([^"]+)"/.exec(userText);
    const bookingId = bookingMatch?.[1] ?? "BK-UNKNOWN";
    const amountMatch = /"totalAmountUsd"\s*:\s*([0-9.]+)/.exec(userText);
    const amountUsd = amountMatch ? Number(amountMatch[1]) : 1500;

    const approvalTool = request.tools.find((t) => t.name === "request-manager-approval-tool");
    const answerTool = request.tools.find((t) => t.name.startsWith("answer"));
    const toolResultMsg = [...request.messages]
      .reverse()
      .find((m) => m.role === ModelProviderMessageRole.Tool);

    // 1. ItineraryBriefAgent (tests BudgetExceededError when bookingId starts with BUDGET-EXCEED-)
    if (systemText.includes("Itinerary Brief Agent") && answerTool !== undefined) {
      const isExceed = bookingId.startsWith("BUDGET-EXCEED-");
      if (isExceed && request.messages.length <= 2) {
        // Turn 1 spends $1.50 (> $0.50 execution budget); Turn 2 is blocked by BudgetExceededError!
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
            arguments: {
              brief: `Executive itinerary prepared for ${bookingId}`,
            },
          },
        ],
        usage: { inputTokens: 100, outputTokens: 50 },
      };
    }

    // 2. ManagerApprovalCoordinatorAgent:
    // Turn 1: call request-manager-approval-tool (which pauses on CorporateBookingApprovalChannel)
    // Turn 2: return HighValueHoldOutputDto via answer tool
    if (systemText.includes("Manager Approval Coordinator Agent")) {
      if (approvalTool !== undefined && toolResultMsg === undefined) {
        return {
          text: "",
          toolCalls: [
            {
              id: `call-hold-${bookingId}`,
              name: approvalTool.name,
              arguments: {
                bookingId,
                amountUsd,
              },
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
              arguments: {
                approvalToken: parsed.approvalToken,
                approved: parsed.approved,
              },
            },
          ],
          usage: { inputTokens: 80, outputTokens: 25 },
        };
      }
    }

    // 3. Parallel Quorum Reviewers (Finance, Compliance, Risk)
    if (systemText.includes("Finance Reviewer Agent") && answerTool !== undefined) {
      if (bookingId.startsWith("WITHDRAW-")) {
        await waitForChannelAskSent();
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
      if (bookingId.startsWith("WITHDRAW-")) {
        await waitForChannelAskSent();
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
              arguments: {
                bookingId,
                amountUsd,
              },
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

@Application({
  name: "travel-booking-saga-application",
  version: "0.1.0",
  environment: AppEnvironment,
  workflows: [
    PaymentSagaWorkflow,
    BudgetSagaWorkflow,
    HitlHoldSagaWorkflow,
    QuorumSagaWorkflow,
  ],
  providers: [
    OpenRouterModelProvider,
    SagaOfflineModelProvider,
    CorporateBookingApprovalChannel,
    SqliteCheckpointSaver,
    SqliteCostLedgerRepository,
    SqliteExecutionLeaseRepository,
    SqliteExecutionRecordRepository,
    SqliteExecutionHistoryRepository,
    SqliteExecutionTreeRepository,
    SqlitePausedExecutionRepository,
  ],
  budgets: [
    SagaApplicationDailyBudget,
    SagaTenantDailyBudget,
    SagaExecutionBudget,
  ],
})
export class TravelBookingSagaApplication {}
