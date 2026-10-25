import { ExecutionContext } from "agboss";
import { Text } from "agboss/dto";

export class HelloExecutionContext extends ExecutionContext {
  @Text({ minLength: 1 })
  userId!: string;
}
