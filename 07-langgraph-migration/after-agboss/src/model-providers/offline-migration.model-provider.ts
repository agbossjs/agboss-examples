import { ModelCost, ModelProvider, RetryPolicy } from "@agboss/core/models";
import { minutes, seconds } from "@agboss/core/units";
import { MigrationOfflineTransport } from "../../../../scripts/tooling/offline-transports.js";

@ModelProvider({
  name: "offline-migration-model-provider",
  description:
    "Deterministic offline provider serving migrated SupportWorkflow models without API keys.",
  serves: [/^openai\//u, /^moonshotai\//u],
  timeout: seconds(30),
  cost: ModelCost.fromResponse(),
  retryPolicy: RetryPolicy.none(),
  circuitBreakerPolicy: {
    failureThreshold: 5,
    window: minutes(1),
    openFor: seconds(10),
  },
})
export class OfflineMigrationModelProvider extends MigrationOfflineTransport {}
