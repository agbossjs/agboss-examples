import { Agent, FileView, ModelFiles } from "@agboss/core";
import { kilobytes } from "@agboss/core/units";
import { InvoiceReviewRequestDto } from "../../dto/invoice-review-request.dto.js";
import { InvoiceReplyJudge } from "../../judges/invoice-reply.judge.js";

/**
 * Reads the invoice file a caller sent over A2A (`FileSource.Input`, the default): a CSV is text, so
 * its model reads it as it is (`FileView.Original`). A plain-text answer (no output DTO) streams.
 */
@Agent({
  name: "invoice-reviewer-agent",
  description: "Reads an invoice CSV and answers the customer's question about it",
  promptUrls: ["./invoice-reviewer.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { request: InvoiceReviewRequestDto },
  files: ModelFiles.of({
    views: [FileView.Original],
    allowedMediaTypes: ["text/csv"],
    maxFileSize: kilobytes(16),
    maxTotalFileSize: kilobytes(16),
    maxFiles: 1,
  }),
  judges: [InvoiceReplyJudge],
  maxRetries: 1,
  maxTokens: 300,
})
export class InvoiceReviewerAgent {}
