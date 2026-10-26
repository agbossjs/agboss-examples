import { Integer, Text } from "@agboss/core/dto";

export class DecomposeNodeDto {
  @Text({ prompt: "Task node label (e.g. root-shard or root-shard/left)" })
  nodeLabel!: string;

  @Integer({ prompt: "Tree level starting at 1", min: 1 })
  level!: number;
}
