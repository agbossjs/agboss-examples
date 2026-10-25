import { createApp } from "agboss";
import {
  installOfflineNetworkGuard,
  isLiveDemoRequested,
  requireLiveApiKey,
} from "../../scripts/tooling/offline-transports.js";
import { runEvalScenario } from "../scenarios/evals.js";
import { runMemoryDriftScenario } from "../scenarios/memory-drift.js";
import { runPiiScenario } from "../scenarios/pii.js";
import { runPolicyScenario } from "../scenarios/policy.js";
import {
  getRecordedToolOperations,
  resetRecordedToolOperations,
} from "./services/order-book.service.js";
import { SupportRefundDeskApplication } from "./support-refund-desk.application.js";
import { LiveSupportRefundWorkflowStart } from "./workflows/live-support-refund/live-support-refund.workflow-start.js";

const isLive = isLiveDemoRequested();
if (isLive) {
  requireLiveApiKey();
}
const restoreFetch = isLive ? (): void => undefined : installOfflineNetworkGuard();

try {
  const pii = await runPiiScenario();
  const policy = await runPolicyScenario();
  const memoryDrift = await runMemoryDriftScenario();
  const evals = await runEvalScenario();

  let liveOpenRouterResult: Record<string, unknown> | undefined;
  if (isLive) {
    resetRecordedToolOperations();
    const app = await createApp(SupportRefundDeskApplication);
    try {
      const res = await app.execute(
        LiveSupportRefundWorkflowStart,
        {
          customerName: "Alice Synth",
          message:
            "Please refund order ORD-1001 ($180). My email is alice.synth@example.com, phone +1-415-555-0101, and ticket TCK-402910.",
        },
        {
          tenant: { tenantId: "acme", maxAutoRefundUsd: 500 },
          execution: { locale: "en" },
          record: true,
        },
      );
      const ops = getRecordedToolOperations();
      const refundOp = ops.find((op) => op.kind === "refund" && op.orderId === "ORD-1001");
      const serializedRecord = JSON.stringify(res.record ?? {});
      liveOpenRouterResult = {
        model: "openai/gpt-4o-mini",
        status: res.status,
        output: res.output,
        toolReceivedRealEmail: refundOp?.receivedEmail ?? "",
        recordMaskedEmail:
          !serializedRecord.includes("alice.synth@example.com") &&
          !serializedRecord.includes("+1-415-555-0101"),
      };
    } finally {
      await app.close();
    }
  }

  console.log(
    JSON.stringify(
      {
        project: "support-refund-desk",
        status: "passed",
        scenarios: {
          pii,
          policy,
          memoryDrift,
          evals,
          ...(liveOpenRouterResult !== undefined
            ? { liveOpenRouter: liveOpenRouterResult }
            : {}),
        },
      },
      null,
      2,
    ),
  );
} finally {
  restoreFetch();
}
