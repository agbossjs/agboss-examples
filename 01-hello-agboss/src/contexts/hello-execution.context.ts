import { ExecutionContext } from "@agboss/core";
import { Text } from "@agboss/core/dto";

export class HelloExecutionContext extends ExecutionContext {
  @Text({ minLength: 1 })
  userId!: string;
}
