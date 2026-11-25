import { CircuitBreakerPolicy, ModelCost, ModelProvider } from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";
import { OfflineNoopTransport } from "../../../../../scripts/tooling/offline-transports.js";

@ModelProvider({
  name: "catalog-offline-model-provider",
  description: "Offline model provider for CatalogApplication",
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  circuitBreakerPolicy: CircuitBreakerPolicy.fixed({
    failureThreshold: 5,
    failureWindow: minutes(1),
    openDuration: seconds(10),
  }),
})
export class CatalogOfflineModelProvider extends OfflineNoopTransport {}
