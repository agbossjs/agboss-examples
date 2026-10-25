import { Text } from "agboss/dto";

export class DecomposeFailedDto {
  @Text({ prompt: "Node label that failed" })
  nodeLabel!: string;
}
