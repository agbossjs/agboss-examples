import { ModelCost, ModelProvider, RetryPolicy } from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";
import {
  SupportOfflineTransport,
  configureSupportModel,
  getRecordedModelRequests,
  resetSupportModel,
  type SupportModelConfig,
} from "../../../scripts/tooling/offline-transports.js";

export {
  configureSupportModel,
  getRecordedModelRequests,
  resetSupportModel,
  type SupportModelConfig,
};

@ModelProvider({
  name: "support-offline-model-provider",
  description:
    "Deterministic offline model provider for support-refund-desk scenarios and eval suites.",
  serves: [/^(?:offline|delegate|openai)\//u],
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  retryPolicy: RetryPolicy.none(),
  circuitBreakerPolicy: {
    failureThreshold: 10,
    window: minutes(1),
    openFor: seconds(10),
  },
})
export class SupportOfflineModelProvider extends SupportOfflineTransport {}
