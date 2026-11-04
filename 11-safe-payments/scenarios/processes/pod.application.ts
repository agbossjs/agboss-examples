import {
  Application,
  FencedEffectSettings,
  Injectable,
  SqliteConnection,
  SqliteFencedEffectRepository,
  StoreClock,
  type FencedEffectKey,
  type FencedEffectOutcome,
  type FencedEffectWork,
} from "@agboss/core";
import type { DatabaseSync } from "node:sqlite";
import { AppEnvironment } from "../../src/environments/app.environment.js";
import { ApprovalInboxChannel } from "../../src/channels/approval-inbox.channel.js";
import { AwaitedOutcomeChannel } from "../../src/channels/awaited-outcome.channel.js";
import { OpenRouterModelProvider } from "../../src/model-providers/openrouter.model-provider.js";
import { SAFE_PAYMENTS_BUDGETS, SAFE_PAYMENTS_PROVIDERS } from "../../src/safe-payments.application.js";
import { CheckoutWorkflow } from "../../src/workflows/checkout/checkout.workflow.js";

/** What a pod leaves out: the agents' model provider and channels (a pod runs the checkout only). */
const NOT_IN_A_POD: readonly unknown[] = [
  OpenRouterModelProvider,
  ApprovalInboxChannel,
  AwaitedOutcomeChannel,
  SqliteFencedEffectRepository,
];

/**
 * The fenced effects of a pod, with one seam: before the effect `POD_HOLD_EFFECT` names, the pod
 * tells its driver and waits — forever: the driver `SIGKILL`s it there (PS2: the charge answered,
 * its booking — the step's end — never written).
 */
@Injectable({ deps: [SqliteConnection, StoreClock, FencedEffectSettings] })
export class PodFencedEffectRepository extends SqliteFencedEffectRepository {
  override async saveResultIfAbsent<TResult>(
    key: FencedEffectKey,
    work: FencedEffectWork<DatabaseSync, TResult>,
  ): Promise<FencedEffectOutcome<TResult>> {
    if (key.name === process.env.POD_HOLD_EFFECT) {
      process.send?.({ at: `effect:${key.name}` });
      await new Promise<never>(() => undefined);
    }
    return super.saveResultIfAbsent(key, work);
  }
}

/** The application as one pod runs it: the checkout on the same stores, the pod's fenced effects. */
@Application({
  name: "safe-payments-application",
  version: "1.0.0",
  environment: AppEnvironment,
  pseudonymKey: "piiPseudonymKey",
  workflows: [CheckoutWorkflow],
  budgets: SAFE_PAYMENTS_BUDGETS,
  providers: [
    ...SAFE_PAYMENTS_PROVIDERS.filter((provider) => !NOT_IN_A_POD.includes(provider)),
    PodFencedEffectRepository,
  ],
})
export class PodApplication {}

// its workflow, for `agboss check --application` on this file (the types it writes are the same)
export { CheckoutWorkflow };
