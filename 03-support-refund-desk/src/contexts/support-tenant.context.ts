import { TenantContext } from "@agboss/core";
import { Float } from "@agboss/core/dto";

export class SupportTenantContext extends TenantContext {
  @Float({ min: 0 })
  maxAutoRefundUsd!: number;
}
