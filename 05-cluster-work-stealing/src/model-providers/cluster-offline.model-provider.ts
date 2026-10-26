import { ModelCost, ModelProvider, RetryPolicy } from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";
import { ClusterOfflineTransport } from "../../../scripts/tooling/offline-transports.js";

@ModelProvider({
  name: "cluster-offline-model-provider",
  description: "Deterministic offline model provider for cluster worker and shard agents",
  serves: [/^openai\//u, /^offline\//u],
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  retryPolicy: RetryPolicy.none(),
  circuitBreakerPolicy: {
    failureThreshold: 5,
    window: minutes(1),
    openFor: seconds(10),
  },
})
export class ClusterOfflineModelProvider extends ClusterOfflineTransport {}
