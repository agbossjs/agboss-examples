import {
  Action,
  listOf,
  oneOf,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { DecomposeFailedDto } from "../dto/decompose-failed.dto.js";
import { DecomposeNodeDto } from "../dto/decompose-node.dto.js";
import { DecomposedLeafDto } from "../dto/decomposed-leaf.dto.js";

@Action({
  name: "merge-shards-action",
  description: "Merges child shard reports into a single parent report",
  input: {
    node: DecomposeNodeDto,
    children: listOf(oneOf(DecomposedLeafDto, DecomposeFailedDto)),
  },
  output: DecomposedLeafDto,
})
export class MergeShardsAction implements ActionHandler<MergeShardsAction> {
  execute(input: InputOf<MergeShardsAction>): Promise<OutputOf<MergeShardsAction>> {
    const parts = input.children.map((child) =>
      "report" in child.value
        ? child.value.report
        : `FAILED(${child.value.nodeLabel})`,
    );
    return Promise.resolve({
      report: `${input.node.value.nodeLabel}: [${parts.join(", ")}]`,
    });
  }
}
