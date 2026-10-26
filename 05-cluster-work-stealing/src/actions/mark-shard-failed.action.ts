import {
  Action,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { DecomposeFailedDto } from "../dto/decompose-failed.dto.js";
import { DecomposeNodeDto } from "../dto/decompose-node.dto.js";

@Action({
  name: "mark-shard-failed-action",
  description: "Marks a shard node as soft-failed",
  input: { node: DecomposeNodeDto },
  output: DecomposeFailedDto,
})
export class MarkShardFailedAction
  implements ActionHandler<MarkShardFailedAction>
{
  execute(
    input: InputOf<MarkShardFailedAction>,
  ): Promise<OutputOf<MarkShardFailedAction>> {
    return Promise.resolve({
      nodeLabel: input.node.value.nodeLabel,
    });
  }
}
