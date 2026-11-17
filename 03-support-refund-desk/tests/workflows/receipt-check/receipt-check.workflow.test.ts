import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FileRedactor, PiiRefusedError } from "@agboss/core";
import { replyWith, testWith } from "@agboss/core/testing";
import { usd } from "@agboss/core/units";
import { expect } from "vitest";
import { SupportRefundDeskApplication } from "../../../src/support-refund-desk.application.js";
import { ReceiptReaderAgent } from "../../../src/agents/receipt-reader/receipt-reader.agent.js";
import { ReceiptCheckWorkflowFinish } from "../../../src/workflows/receipt-check/receipt-check.workflow-finish.js";
import { ReceiptCheckWorkflowStart } from "../../../src/workflows/receipt-check/receipt-check.workflow-start.js";

/**
 * #899: the receipt a customer attaches reaches the reader's model as a redacted copy made by the built-in
 * redactor (scripted here: mockLlm(FileRedactor)), never as the original; an IBAN found in it refuses it.
 */

process.env["OPENROUTER_API_KEY"] ??= "offline-test-openrouter-api-key";

const test = testWith(SupportRefundDeskApplication);

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const RECEIPT = readFileSync(join(PROJECT_ROOT, "fixtures", "receipt-card-statement.png"));
const CONTEXTS = { tenant: { tenantId: "acme", maxAutoRefundUsd: 500 }, execution: { locale: "en" } } as const;

const sha256Of = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");
const request = {
  message: "Please refund order ORD-1001 to alice.synth@example.com, the receipt is attached.",
  receipt: {
    mediaType: "image/png",
    filename: "receipt.png",
    inline: RECEIPT.toString("base64"),
    sha256: sha256Of(RECEIPT),
    sizeBytes: RECEIPT.byteLength,
  },
};

// where the card number and the name are on the fixture, as fractions of the image
const CARD_REGION = { x: 0.04, y: 0.46, w: 0.54, h: 0.1 };

test("the receipt reaches the model as a redacted copy, never as the original", async ({ app, mockLlm }) => {
  const redactor = mockLlm(FileRedactor).thenReturn(
    replyWith(JSON.stringify({ regions: [{ target: "card-number", ...CARD_REGION }] }), {
      cost: usd(0.0004),
    }),
  );
  const agent = mockLlm(ReceiptReaderAgent).thenReturn(replyWith("Northwind Store, ORD-1001, $180.00."));

  const result = await app.execute(ReceiptCheckWorkflowStart, request, CONTEXTS);

  expect(redactor.requests).toHaveLength(1);
  const [asked] = agent.requests;
  const parts = asked?.kind === "chat" ? asked.parts : [];
  const sent = asked?.kind === "chat" ? JSON.stringify([asked.input, asked.messages]) : "";
  expect(parts).toHaveLength(1);
  expect(parts[0]?.mediaType).toBe("image/png");
  expect(parts[0]?.sha256).not.toBe(request.receipt.sha256);
  expect(result).toFinishWith(ReceiptCheckWorkflowFinish, { text: "Northwind Store, ORD-1001, $180.00." });
  expect(result.spend.byCaller["files:redactor"]).toBeCloseTo(0.0004);
  expect(result.spend.byCategory.files).toBeCloseTo(0.0004);
  expect(sent).not.toContain("alice.synth@example.com");
});

test("an IBAN found on the receipt refuses it: the reader's model is never called", async ({ app, mockLlm }) => {
  mockLlm(FileRedactor).thenReturn(
    replyWith(JSON.stringify({ regions: [{ target: "iban", ...CARD_REGION }] })),
  );
  const agent = mockLlm(ReceiptReaderAgent);

  const run = app.execute(ReceiptCheckWorkflowStart, request, CONTEXTS);

  await expect(run).rejects.toBeInstanceOf(PiiRefusedError);
  expect(agent).toHaveBeenCalledTimes(0);
});

test("a redaction answer that is not the regions fails closed: no model sees the receipt", async ({
  app,
  mockLlm,
}) => {
  mockLlm(FileRedactor).thenReturn(replyWith("There is no personal data in this image."));
  const agent = mockLlm(ReceiptReaderAgent);

  await expect(app.execute(ReceiptCheckWorkflowStart, request, CONTEXTS)).rejects.toMatchObject({
    code: "step.file-redaction-failed",
  });
  expect(agent).toHaveBeenCalledTimes(0);
});
