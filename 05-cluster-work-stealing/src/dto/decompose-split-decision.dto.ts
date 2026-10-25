import { Text } from "agboss/dto";

export class DecomposeSplitDecisionDto {
  @Text({ prompt: "Why this node must split into two sub-shards" })
  reason!: string;
}
