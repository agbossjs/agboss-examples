import { Text } from "@agboss/core/dto";

export class DecomposedLeafDto {
  @Text({ prompt: "Completed leaf or merged report" })
  report!: string;
}
