import { Float, Text } from "@agboss/core/dto";

export class BillingResolutionDto {
  @Text({ prompt: "Invoice ID inspected" })
  invoiceId!: string;

  @Text({ prompt: "Billing resolution summary" })
  resolution!: string;

  @Float({ prompt: "Credited amount in USD", min: 0 })
  creditedUsd!: number;

  @Text({ prompt: "Authenticated tenant ID resolved by the A2A host" })
  resolvedTenantId!: string;
}
