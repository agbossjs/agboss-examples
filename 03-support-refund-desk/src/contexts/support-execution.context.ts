import { ExecutionContext } from "@agboss/core";
import { Enum } from "@agboss/core/dto";

export class SupportExecutionContext extends ExecutionContext {
  @Enum(["en", "es"])
  locale!: "en" | "es";
}
