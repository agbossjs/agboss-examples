import { CircuitBreakerPolicy, ModelCost, ModelProvider } from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";
import { TriageOfflineTransport } from "../../../../../scripts/tooling/offline-transports.js";

@ModelProvider({
  name: "triage-offline-model-provider",
  description: "Deterministic offline model provider driving TriageAgent tool calls",
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  circuitBreakerPolicy: CircuitBreakerPolicy.fixed({
    failureThreshold: 5,
    failureWindow: minutes(1),
    openDuration: seconds(10),
  }),
})
export class TriageOfflineModelProvider extends TriageOfflineTransport {}
