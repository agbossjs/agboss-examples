import { Decimal, Text } from "@agboss/core/dto";

export class TriageResponseDto {
  @Text({ prompt: "Invoice ID checked" })
  invoiceId!: string;

  @Text({ prompt: "SKU checked" })
  sku!: string;

  @Text({ prompt: "Combined resolution from billing A2A and catalog MCP" })
  summary!: string;

  @Decimal({ prompt: "Credited amount in USD from billing", min: 0 })
  creditedUsd!: number;
}
