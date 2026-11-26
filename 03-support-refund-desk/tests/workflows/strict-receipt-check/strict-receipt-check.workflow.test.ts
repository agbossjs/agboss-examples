import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FileRedactor, PiiKind, PiiError } from "@agboss/core";
import { testWith } from "@agboss/core/testing";
import { expect } from "vitest";
import { SupportRefundDeskApplication } from "../../../src/support-refund-desk.application.js";
import { StrictReceiptReaderAgent } from "../../../src/agents/strict-receipt-reader/strict-receipt-reader.agent.js";
import { StrictReceiptCheckWorkflowStart } from "../../../src/workflows/strict-receipt-check/strict-receipt-check.workflow-start.js";

/** #899: under the desk's block rule (card numbers) an image is refused whole, before any model, the redaction model included. */

process.env["OPENROUTER_API_KEY"] ??= "offline-test-openrouter-api-key";

const test = testWith(SupportRefundDeskApplication);

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const RECEIPT = readFileSync(join(PROJECT_ROOT, "fixtures", "receipt-card-statement.png"));

test("a block rule refuses the receipt whole: neither the redactor nor the reader is called", async ({
  app,
  mockModel,
}) => {
  const redactor = mockModel(FileRedactor);
  const agent = mockModel(StrictReceiptReaderAgent);

  const run = app.execute(
    StrictReceiptCheckWorkflowStart,
    {
      message: "Please refund order ORD-1001, the receipt is attached.",
      receipt: {
        mediaType: "image/png",
        filename: "receipt.png",
        inline: RECEIPT.toString("base64"),
        sha256: createHash("sha256").update(RECEIPT).digest("hex"),
        sizeBytes: RECEIPT.byteLength,
      },
    },
    { tenant: { tenantId: "acme", maxAutoRefundUsd: 500 }, execution: { locale: "en" } },
  );

  await expect(run).rejects.toBeInstanceOf(PiiError.Refused);
  await expect(run).rejects.toMatchObject({ piiKind: PiiKind.CardNumber.id });
  expect(redactor).toHaveBeenCalledTimes(0);
  expect(agent).toHaveBeenCalledTimes(0);
});
