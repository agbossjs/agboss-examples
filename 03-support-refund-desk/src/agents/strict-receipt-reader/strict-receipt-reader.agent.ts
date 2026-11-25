import { Agent, FileView, ModelFiles, inline } from "@agboss/core";
import { kilobytes } from "@agboss/core/units";
import { ReceiptRefundRequestDto } from "../../dto/receipt-refund-request.dto.js";

/**
 * Reads a receipt under the desk-wide policy as it is: that policy blocks a card number, and a block
 * rule refuses an image whole (`PiiRefusedError`) before any model is asked, the redaction model
 * included. Nothing a model could be talked out of: the strict choice for a photo.
 */
@Agent({
  name: "strict-receipt-reader-agent",
  description: "Reads a receipt photo, refusing it whole under the desk's block rule",
  prompt: inline("Say what the receipt shows: the store, the order and the total. One line."),
  model: "google/gemini-2.5-flash-lite",
  input: { request: ReceiptRefundRequestDto },
  files: ModelFiles.of({
    views: [FileView.Redacted],
    allowedMediaTypes: ["image/png", "image/jpeg"],
    maxFileSize: kilobytes(60),
  }),
})
export class StrictReceiptReaderAgent {}
