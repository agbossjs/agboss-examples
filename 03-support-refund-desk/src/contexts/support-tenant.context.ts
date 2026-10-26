import { TenantContext } from "@agboss/core";
import { Decimal } from "@agboss/core/dto";

export class SupportTenantContext extends TenantContext {
  @Decimal({ min: 0 })
  maxAutoRefundUsd!: number;
}
