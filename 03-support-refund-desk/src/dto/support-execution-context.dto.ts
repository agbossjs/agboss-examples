import { ExecutionContext } from "agboss";
import { OneOf } from "agboss/dto";

export class SupportExecutionContext extends ExecutionContext {
  @OneOf({ values: ["en", "es"] })
  locale!: "en" | "es";
}
