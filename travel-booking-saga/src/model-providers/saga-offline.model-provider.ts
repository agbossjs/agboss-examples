import {
  ModelCost,
  ModelProvider,
  ModelProviderMessageRole,
  RetryPolicy,
  TRANSIENT_FAILURES,
  type ModelProviderHandler,
  type ModelProviderRequest,
  type ModelProviderResponse,
} from "agboss/models";
import { minutes, seconds, usd } from "agboss/units";
import { waitForChannelAskSent } from "../channels/corporate-booking-approval.channel.js";

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

    // 2. ManagerApprovalCoordinatorAgent
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
