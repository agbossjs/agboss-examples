import { Text } from "@agboss/core/dto";

export class DecomposeFailedDto {
  @Text({ prompt: "Node label that failed" })
  nodeLabel!: string;
}
