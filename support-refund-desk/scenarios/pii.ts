import { createApp, PiiKind, PiiRefusedError } from "agboss";
import { createServer } from "node:http";
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
  readonly langfuseTraceUrlMatchesSession: boolean;
  readonly langfuseOtelSpansExported: boolean;
  readonly langfuseOtelSpansMaskedPii: boolean;
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

    // 3. Verify Langfuse (@langfuse/langchain + @langfuse/otel) OTel span export & PII masking (#120 AC7)
    const exportedChunks: Buffer[] = [];
    const langfuseCollector = createServer((req, res) => {
      const body: Buffer[] = [];
      req.on("data", (chunk: Buffer) => body.push(chunk));
      req.on("end", () => {
        exportedChunks.push(Buffer.concat(body));
        res.writeHead(200, { "content-type": "application/json" });
        res.end("{}");
      });
    });
    await new Promise<void>((resolveListen) =>
      langfuseCollector.listen(0, "127.0.0.1", resolveListen),
    );
    const collectorAddress = langfuseCollector.address();
    const collectorPort =
      typeof collectorAddress === "object" && collectorAddress !== null
        ? collectorAddress.port
        : 0;
    const langfuseBaseUrl = `http://127.0.0.1:${String(collectorPort)}`;

    let langfuseTraceUrlMatchesSession = false;
    let langfuseOtelSpansExported = false;
    let langfuseOtelSpansMaskedPii = false;

    try {
      const tracedApp = await createApp(SupportRefundDeskApplication, {
        processEnv: {
          ...process.env,
          OPENROUTER_API_KEY:
            process.env.OPENROUTER_API_KEY ??
            process.env.OPEN_ROUTER_KEY ??
            "offline-test-openrouter-api-key",
          PII_PSEUDONYM_KEY: "agboss-test-pseudonym-key",
          LANGFUSE_PUBLIC_KEY: "pk-lf-agboss-proof",
          LANGFUSE_SECRET_KEY: "sk-lf-agboss-proof",
          LANGFUSE_BASE_URL: langfuseBaseUrl,
          LANGFUSE_PROJECT_ID: "proj-support",
        },
      });
      try {
        const tracedResult = await tracedApp.execute(
          SupportRefundWorkflowStart,
          {
            customerName: "Alice Synth",
            message:
              "Please refund order ORD-1001 ($180). My email is alice.synth@example.com, phone +1-415-555-0101, and ticket TCK-402910.",
          },
          {
            threadId: "thread-langfuse-pii",
            tenant: { tenantId: "acme", maxAutoRefundUsd: 500 },
            execution: { locale: "en" },
          },
        );
        langfuseTraceUrlMatchesSession =
          tracedResult.traceUrl ===
          `${langfuseBaseUrl}/project/proj-support/sessions/thread-langfuse-pii`;
      } finally {
        await tracedApp.close();
      }

      const rawOtelExport = Buffer.concat(exportedChunks).toString("utf8");
      langfuseOtelSpansExported =
        rawOtelExport.length > 0 &&
        rawOtelExport.includes("thread-langfuse-pii") &&
        rawOtelExport.includes("tenant:acme");
      langfuseOtelSpansMaskedPii =
        rawOtelExport.includes("<email:d1ac5c>") &&
        rawOtelExport.includes("<support-ticket-id:") &&
        !rawOtelExport.includes("alice.synth@example.com") &&
        !rawOtelExport.includes("+1-415-555-0101") &&
        !rawOtelExport.includes("TCK-402910");
    } finally {
      await new Promise<void>((resolveClose) =>
        langfuseCollector.close(() => resolveClose()),
      );
    }

    if (
      !langfuseTraceUrlMatchesSession ||
      !langfuseOtelSpansExported ||
      !langfuseOtelSpansMaskedPii
    ) {
      throw new Error("Langfuse OTel PII masking verification failed");
    }

    return {
      modelSawMaskedEmailToken,
      modelSawMaskedTicketToken,
      modelSawRawEmail,
      toolReceivedRealEmail,
      recordMaskedEmail,
      blockedCardRefusalKind,
      langfuseTraceUrlMatchesSession,
      langfuseOtelSpansExported,
      langfuseOtelSpansMaskedPii,
    };
  } finally {
    await app.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const out = await runPiiScenario();
  console.log("[scenario:pii] Verified PII token roundtrip & boundary refusal:", JSON.stringify(out));
}
