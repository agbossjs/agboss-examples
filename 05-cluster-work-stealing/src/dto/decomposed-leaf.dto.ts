import { Text } from "agboss/dto";

export class DecomposedLeafDto {
  @Text({ prompt: "Completed leaf or merged report" })
  report!: string;
}
