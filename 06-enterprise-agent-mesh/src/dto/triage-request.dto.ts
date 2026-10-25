import { Text } from "agboss/dto";

export class TriageRequestDto {
  @Text({ prompt: "Invoice ID to check with billing (e.g. INV-5001)" })
  invoiceId!: string;

  @Text({ prompt: "Product SKU to check in the catalog (e.g. SKU-GPU-900)" })
  sku!: string;

  @Text({ prompt: "Customer inquiry text" })
  question!: string;
}
