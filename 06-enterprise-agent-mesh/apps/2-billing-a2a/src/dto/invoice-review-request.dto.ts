import { A2AFileDto } from "@agboss/core/a2a";
import { Nested, Text } from "@agboss/core/dto";

/** What a caller sends to have an invoice reviewed: a question and the invoice itself, a CSV file. */
export class InvoiceReviewRequestDto {
  @Text({ prompt: "Customer question about the invoice" })
  question!: string;

  @Nested(A2AFileDto, { prompt: "The invoice's line items, a CSV: sku,qty,unit_usd" })
  invoice!: A2AFileDto;
}
