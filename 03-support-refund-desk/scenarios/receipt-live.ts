import "../src/scripts/offline-keys.js";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Opt-in live run (`npm run demo:files:live`): the receipt photo goes through the real redaction model and
 * the real reader on OpenRouter (google/gemini-2.5-flash-lite). Skips without OPENROUTER_API_KEY, so
 * `npm run demo` stays offline. With RECEIPT_OUT_DIR set it writes the image each model call carried.
 */
const key = process.env["OPENROUTER_API_KEY"]?.trim() ?? "";
if (key === "" || key === "offline-test-openrouter-api-key") {
  console.log("[demo:files:live] skipped: set OPENROUTER_API_KEY to run the receipt redaction on a real model.");
  process.exit(0);
}

process.env["RECEIPT_LIVE"] = "1"; // the receipt readers go to the real OpenRouter provider (src/config/receipt-live.ts)

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const receipt = readFileSync(join(root, "fixtures", "receipt-card-statement.png"));
const sha256Of = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const outDir = process.env["RECEIPT_OUT_DIR"];

// what the models were sent and answered, seen at the wire: the image of each call, the redaction model's regions
const originalFetch = globalThis.fetch;
let imagesSeen = 0;
globalThis.fetch = async (input, init) => {
  const response = await originalFetch(input, init);
  const body = typeof init?.body === "string" ? init.body : "";
  for (const match of body.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/gu)) {
    const bytes = Buffer.from(match[1] ?? "", "base64");
    imagesSeen += 1;
    // the first call is the redaction model's (the photo, re-encoded upright), the second the reader's (the redacted copy)
    const who = imagesSeen === 1 ? "redactor" : "reader";
    console.log(`[wire] ${who} call: image ${sha256Of(bytes) === sha256Of(receipt) ? "is the original file" : "differs from the original file"} (${String(bytes.byteLength)} bytes)`);
    if (outDir !== undefined) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, `${who}-input.png`), bytes);
    }
    void response.clone().text().then((text) => {
      console.log(`[wire] ${who} answer: ${text.slice(0, 700)}`);
    });
  }
  return response;
};

const { createApp } = await import("@agboss/core");
const { SupportRefundDeskApplication } = await import("../src/support-refund-desk.application.js");
const { ReceiptCheckWorkflowStart } = await import(
  "../src/workflows/receipt-check/receipt-check.workflow-start.js"
);

const app = await createApp(SupportRefundDeskApplication);
try {
  const result = await app.execute(
    ReceiptCheckWorkflowStart,
    {
      message: "Please refund order ORD-1001, the receipt is attached.",
      receipt: {
        mediaType: "image/png",
        filename: "receipt.png",
        inline: receipt.toString("base64"),
        sha256: sha256Of(receipt),
        sizeBytes: receipt.byteLength,
      },
    },
    { tenant: { tenantId: "acme", maxAutoRefundUsd: 500 }, execution: { locale: "en" } },
  );
  console.log(
    JSON.stringify({ status: result.status, output: result.output, spend: result.spend.byCaller, totalUsd: result.spend.totalUsd }, null, 2),
  );
} finally {
  await app.close();
}
