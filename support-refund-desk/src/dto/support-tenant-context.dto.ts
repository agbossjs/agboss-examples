import { TenantContext } from "agboss";
import { Decimal } from "agboss/dto";

export class SupportTenantContext extends TenantContext {
  @Decimal({ min: 0 })
  maxAutoRefundUsd!: number;
}
