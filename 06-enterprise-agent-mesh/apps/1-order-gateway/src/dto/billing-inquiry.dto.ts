import { Text } from "@agboss/core/dto";

export class BillingInquiryDto {
  @Text({ prompt: "Invoice ID to inspect (e.g. INV-5001)" })
  invoiceId!: string;

  @Text({ prompt: "Customer question about the invoice" })
  question!: string;
}
