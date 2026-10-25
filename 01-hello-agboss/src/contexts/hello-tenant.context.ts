import { TenantContext } from "agboss";
import { OneOf } from "agboss/dto";

export class HelloTenantContext extends TenantContext {
  @OneOf({ values: ["starter", "pro", "enterprise"] })
  plan!: "starter" | "pro" | "enterprise";
}
