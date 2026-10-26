import { TenantContext } from "@agboss/core";
import { OneOf } from "@agboss/core/dto";

export class HelloTenantContext extends TenantContext {
  @OneOf({ values: ["starter", "pro", "enterprise"] })
  plan!: "starter" | "pro" | "enterprise";
}
