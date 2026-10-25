import { ModelCost, ModelProvider, RetryPolicy } from "agboss/models";
import { minutes, seconds } from "agboss/units";
import { OfflineNoopTransport } from "../../../scripts/tooling/offline-transports.js";

@ModelProvider({
  name: "catalog-offline-model-provider",
  description: "Offline model provider for CatalogApplication",
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
export class CatalogOfflineModelProvider extends OfflineNoopTransport {}
