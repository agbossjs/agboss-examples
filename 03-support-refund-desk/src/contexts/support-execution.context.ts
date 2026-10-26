import { ExecutionContext } from "@agboss/core";
import { OneOf } from "@agboss/core/dto";

export class SupportExecutionContext extends ExecutionContext {
  @OneOf({ values: ["en", "es"] })
  locale!: "en" | "es";
}
