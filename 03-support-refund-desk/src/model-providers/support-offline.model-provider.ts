import { CircuitBreakerPolicy, ModelCost, ModelProvider } from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";
import { SupportOfflineTransport, configureSupportModel, getRecordedModelRequests, resetSupportModel, type SupportModelConfig } from "../../../scripts/tooling/offline-transports.js";

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
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  circuitBreakerPolicy: CircuitBreakerPolicy.fixed({
    failureThreshold: 10,
    failureWindow: minutes(1),
    openDuration: seconds(10),
  }),
})
export class SupportOfflineModelProvider extends SupportOfflineTransport {}
