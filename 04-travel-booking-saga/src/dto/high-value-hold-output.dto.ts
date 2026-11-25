import { Bool, Text } from "@agboss/core/dto";

export class HighValueHoldOutputDto {
  @Text({ prompt: "Approval confirmation token" })
  approvalToken!: string;

  @Bool({ prompt: "Whether hold was approved" })
  approved!: boolean;
}
