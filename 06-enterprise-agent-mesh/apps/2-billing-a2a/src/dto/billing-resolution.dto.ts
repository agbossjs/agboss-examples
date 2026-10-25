import { Decimal, Text } from "agboss/dto";

export class BillingResolutionDto {
  @Text({ prompt: "Invoice ID inspected" })
  invoiceId!: string;

  @Text({ prompt: "Billing resolution summary" })
  resolution!: string;

  @Decimal({ prompt: "Credited amount in USD", min: 0 })
  creditedUsd!: number;

  @Text({ prompt: "Authenticated tenant ID resolved by the A2A host" })
  resolvedTenantId!: string;
}
