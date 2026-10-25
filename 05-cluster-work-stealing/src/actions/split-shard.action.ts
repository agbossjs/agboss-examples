import {
  Action,
  listOf,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "agboss";
import { DecomposeNodeDto } from "../dto/decompose-node.dto.js";

@Action({
  name: "split-shard-action",
  description: "Splits a broad shard into left and right child shards",
  input: { node: DecomposeNodeDto },
  output: listOf(DecomposeNodeDto),
})
export class SplitShardAction implements ActionHandler<SplitShardAction> {
  execute(input: InputOf<SplitShardAction>): Promise<OutputOf<SplitShardAction>> {
    const { nodeLabel, level } = input.node.value;
    return Promise.resolve([
      { nodeLabel: `${nodeLabel}/L`, level: level + 1 },
      { nodeLabel: `${nodeLabel}/R`, level: level + 1 },
    ]);
  }
}
