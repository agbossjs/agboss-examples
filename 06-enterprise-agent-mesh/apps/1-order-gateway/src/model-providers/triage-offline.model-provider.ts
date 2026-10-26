import { ModelCost, ModelProvider, RetryPolicy } from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";
import { TriageOfflineTransport } from "../../../../../scripts/tooling/offline-transports.js";

@ModelProvider({
  name: "triage-offline-model-provider",
  description: "Deterministic offline model provider driving TriageAgent tool calls",
  serves: [/^offline\//u],
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  retryPolicy: RetryPolicy.none(),
  circuitBreakerPolicy: {
    failureThreshold: 5,
    window: minutes(1),
    openFor: seconds(10),
  },
})
export class TriageOfflineModelProvider extends TriageOfflineTransport {}
