import { TenantContext } from "@agboss/core";
import { Enum } from "@agboss/core/dto";

export class HelloTenantContext extends TenantContext {
  @Enum(["starter", "pro", "enterprise"])
  plan!: "starter" | "pro" | "enterprise";
}
