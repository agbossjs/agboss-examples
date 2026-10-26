import { Flag, Text } from "@agboss/core/dto";

export class HighValueHoldOutputDto {
  @Text({ prompt: "Approval confirmation token" })
  approvalToken!: string;

  @Flag({ prompt: "Whether hold was approved" })
  approved!: boolean;
}
