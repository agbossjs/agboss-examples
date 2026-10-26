import { Text } from "@agboss/core/dto";

export class DecomposeSplitDecisionDto {
  @Text({ prompt: "Why this node must split into two sub-shards" })
  reason!: string;
}
