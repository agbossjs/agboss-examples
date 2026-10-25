import { createApp } from "agboss";
import { runEvalScenario } from "../scenarios/evals.js";
import { runMemoryDriftScenario } from "../scenarios/memory-drift.js";
import { runPiiScenario } from "../scenarios/pii.js";
import { runPolicyScenario } from "../scenarios/policy.js";
import { SupportRefundDeskApplication } from "./application.js";
import {
  getRecordedToolOperations,
  resetRecordedToolOperations,
} from "./tools/order-book.service.js";
import { LiveSupportRefundWorkflowStart } from "./workflows/support-refund.workflow.js";

const pii = await runPiiScenario();
const policy = await runPolicyScenario();
const memoryDrift = await runMemoryDriftScenario();
const evals = await runEvalScenario();

const hasLiveOpenRouter = Boolean(
  process.env.OPEN_ROUTER_KEY ||
    (process.env.OPENROUTER_API_KEY &&
      process.env.OPENROUTER_API_KEY !== "offline-test-openrouter-api-key"),
);

let liveOpenRouterResult: Record<string, unknown> | undefined;
if (hasLiveOpenRouter) {
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
