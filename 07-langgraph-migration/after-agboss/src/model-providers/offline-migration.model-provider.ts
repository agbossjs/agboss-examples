import { ModelCost, ModelProvider, CircuitBreakerPolicy } from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";
import { MigrationOfflineTransport } from "../../../../scripts/tooling/offline-transports.js";

@ModelProvider({
  name: "offline-migration-model-provider",
  description:
    "Deterministic offline provider serving migrated SupportWorkflow models without API keys.",
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  circuitBreakerPolicy: CircuitBreakerPolicy.fixed({
    failureThreshold: 5,
    failureWindow: minutes(1),
    openDuration: seconds(10),
  }),
})
export class OfflineMigrationModelProvider extends MigrationOfflineTransport {}
