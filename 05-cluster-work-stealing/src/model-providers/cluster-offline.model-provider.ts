import { CircuitBreakerPolicy, ModelCost, ModelProvider } from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";
import { ClusterOfflineTransport } from "../../../scripts/tooling/offline-transports.js";

@ModelProvider({
  name: "cluster-offline-model-provider",
  description: "Deterministic offline model provider for cluster worker and shard agents",
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  circuitBreakerPolicy: CircuitBreakerPolicy.fixed({
    failureThreshold: 5,
    failureWindow: minutes(1),
    openDuration: seconds(10),
  }),
})
export class ClusterOfflineModelProvider extends ClusterOfflineTransport {}
