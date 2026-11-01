import { Text } from "@agboss/core/dto";

/** A refund or a capture as the gateway answered it. */
export class MovementDto {
  @Text({ prompt: "the gateway's id of it" })
  movementId!: string;

  @Text({ prompt: "its status at the gateway" })
  status!: string;
}
