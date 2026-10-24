import { createApp, PiiKind, PiiRefusedError } from "agboss";
import { pathToFileURL } from "node:url";
import {
  getRecordedModelRequests,
  resetSupportModel,
  SupportRefundDeskApplication,
} from "../src/application.js";
import { resetAuditTrail } from "../src/interceptors/audit.interceptor.js";
import {
  getRecordedToolOperations,
  resetRecordedToolOperations,
} from "../src/tools/order-book.service.js";
import { SupportRefundWorkflowStart } from "../src/workflows/support-refund.workflow.js";

export interface PiiScenarioResult {
  readonly modelSawMaskedEmailToken: boolean;
  readonly modelSawMaskedTicketToken: boolean;
  readonly modelSawRawEmail: boolean;
  readonly toolReceivedRealEmail: string;
  readonly recordMaskedEmail: boolean;
  readonly blockedCardRefusalKind: string;
}

export async function runPiiScenario(): Promise<PiiScenarioResult> {
  resetSupportModel();
  resetRecordedToolOperations();
  resetAuditTrail();

  const app = await createApp(SupportRefundDeskApplication);
  try {
    // 1. Execute with raw customer email, phone, customerName, and internal ticket ID
    const result = await app.execute(
      SupportRefundWorkflowStart,
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

    const modelRequests = getRecordedModelRequests();
    const firstModelInput = modelRequests[0]?.messages.map((m) => m.text).join("\n") ?? "";
    const modelSawMaskedEmailToken = /<email:[0-9a-f]+>/u.test(firstModelInput);
    const modelSawMaskedTicketToken = /<support-ticket-id:[0-9a-f]+>/u.test(firstModelInput);
    const modelSawRawEmail =
      firstModelInput.includes("alice.synth@example.com") ||
      firstModelInput.includes("Alice Synth");

    const ops = getRecordedToolOperations();
    const refundOp = ops.find((op) => op.kind === "refund" && op.orderId === "ORD-1001");
    const toolReceivedRealEmail = refundOp?.receivedEmail ?? "";

    const serializedRecord = JSON.stringify(result.record ?? {});
    const recordMaskedEmail =
      !serializedRecord.includes("alice.synth@example.com") &&
      !serializedRecord.includes("+1-415-555-0101");

    if (
      !modelSawMaskedEmailToken ||
      !modelSawMaskedTicketToken ||
      modelSawRawEmail ||
      toolReceivedRealEmail !== "alice.synth@example.com" ||
      !recordMaskedEmail
    ) {
      throw new Error("Scenario A (PII Token Roundtrip) assertion failed");
    }

    // 2. Verify raw payment card number is blocked with PiiRefusedError before reaching model/tools
    let blockedCardRefusalKind = "";
    try {
      await app.execute(
        SupportRefundWorkflowStart,
        {
          customerName: "Alice Synth",
          message:
            "Refund ORD-1001 to my card 4111 1111 1111 1111 (email alice.synth@example.com).",
        },
        {
          tenant: { tenantId: "acme", maxAutoRefundUsd: 500 },
          execution: { locale: "en" },
        },
      );
    } catch (error) {
      if (error instanceof PiiRefusedError && error.kind === PiiKind.CardNumber) {
        blockedCardRefusalKind = error.kind;
      } else {
        throw error;
      }
    }

    if (blockedCardRefusalKind !== PiiKind.CardNumber) {
      throw new Error("Expected PiiRefusedError for CardNumber");
    }

    return {
      modelSawMaskedEmailToken,
      modelSawMaskedTicketToken,
      modelSawRawEmail,
      toolReceivedRealEmail,
      recordMaskedEmail,
      blockedCardRefusalKind,
    };
  } finally {
    await app.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const out = await runPiiScenario();
  console.log("[scenario:pii] Verified PII token roundtrip & boundary refusal:", JSON.stringify(out));
}
