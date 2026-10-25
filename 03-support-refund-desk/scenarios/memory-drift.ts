import { createApp } from "agboss";
import { pathToFileURL } from "node:url";
import {
  getRecordedModelRequests,
  resetSupportModel,
} from "../src/model-providers/support-offline.model-provider.js";
import { setActivePolicyVersion } from "../src/rag/refund-policy.rag.js";
import {
  getRecordedToolOperations,
  resetRecordedToolOperations,
} from "../src/services/order-book.service.js";
import { SupportRefundDeskApplication } from "../src/support-refund-desk.application.js";
import { SupportRefundWorkflowStart } from "../src/workflows/support-refund/support-refund.workflow-start.js";

export interface MemoryDriftScenarioResult {
  readonly threadId: string;
  readonly turnsExecuted: number;
  readonly finalTurnDecision: string;
  readonly finalTurnRefundedUsd: number;
  readonly compactionSummaryInjected: boolean;
  readonly preservedOrderFact: boolean;
}

export async function runMemoryDriftScenario(): Promise<MemoryDriftScenarioResult> {
  resetSupportModel();
  resetRecordedToolOperations();
  setActivePolicyVersion("current");

  const app = await createApp(SupportRefundDeskApplication);
  const threadId = "thread-policy-drift-1003";
  const callOptions = {
    tenant: { tenantId: "acme", maxAutoRefundUsd: 500 },
    execution: { locale: "en" as const },
    threadId,
    ownerId: "customer-bob",
  };

  try {
    // Turn 1 & Turn 2: Establish order ORD-1003 (45 days old, $220) while referencing legacy v1.0 90-day rules
    await app.execute(
      SupportRefundWorkflowStart,
      {
        customerName: "Bob Synth",
        message:
          "Hi, my email is bob.synth@example.com and ticket is TCK-402912. I bought order ORD-1003 (45 days ago) when the v1.0 policy gave 90 days.",
      },
      callOptions,
    );

    await app.execute(
      SupportRefundWorkflowStart,
      {
        customerName: "Bob Synth",
        message: "I am still checking my setup for order ORD-1003 (email bob.synth@example.com).",
      },
      callOptions,
    );

    // Turn 3, Turn 4 & Turn 5: Once 4 prior turns exist (`uncompactedTurns: 2` + `turnsBetweenCompactions: 2`),
    // compaction runs before Turn 5!
    await app.execute(
      SupportRefundWorkflowStart,
      {
        customerName: "Bob Synth",
        message: "Following up on my earlier thread for ORD-1003 (email bob.synth@example.com).",
      },
      callOptions,
    );

    await app.execute(
      SupportRefundWorkflowStart,
      {
        customerName: "Bob Synth",
        message: "Still waiting on confirmation for order ORD-1003 (email bob.synth@example.com).",
      },
      callOptions,
    );

    const finalTurn = await app.execute(
      SupportRefundWorkflowStart,
      {
        customerName: "Bob Synth",
        message: "Please process the refund for my order ORD-1003 now (email bob.synth@example.com).",
      },
      callOptions,
    );

    const allRequests = getRecordedModelRequests().filter(
      (req) => req.model === "offline/support-chat",
    );
    const lastAgentPrompt = allRequests.at(-1)?.messages.map((m) => m.text).join("\n") ?? "";
    const compactionSummaryInjected = lastAgentPrompt.includes("SUPERSEDED");
    const preservedOrderFact = lastAgentPrompt.includes("ORD-1003");
    const finalTurnDecision = finalTurn.output?.decision ?? "";
    const finalTurnRefundedUsd = finalTurn.output?.refundedUsd ?? -1;

    // Verify zero refunds were issued for 45-day-old ORD-1003
    const refundsIssued = getRecordedToolOperations().filter((op) => op.kind === "refund");
    if (
      finalTurnDecision !== "denied" ||
      finalTurnRefundedUsd !== 0 ||
      !compactionSummaryInjected ||
      !preservedOrderFact ||
      refundsIssued.length !== 0
    ) {
      throw new Error("Scenario C (Memory Compaction vs Policy Drift) assertion failed");
    }

    return {
      threadId,
      turnsExecuted: 5,
      finalTurnDecision,
      finalTurnRefundedUsd,
      compactionSummaryInjected,
      preservedOrderFact,
    };
  } finally {
    await app.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const out = await runMemoryDriftScenario();
  console.log("[scenario:memory-drift] Verified compaction & policy drift protection:", JSON.stringify(out));
}
