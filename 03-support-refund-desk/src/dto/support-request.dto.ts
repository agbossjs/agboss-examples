import { PiiAction } from "@agboss/core";
import { Text } from "@agboss/core/dto";

export class SupportRequestDto {
  @Text({ prompt: "Customer support message" })
  message!: string;

  @Text({
    prompt: "Customer full name (masked everywhere by field-level sensitivity)",
    sensitive: PiiAction.replaceWithToken(),
  })
  customerName!: string;
}
