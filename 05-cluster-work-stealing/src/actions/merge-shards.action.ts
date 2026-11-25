import { Action, listOf, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { DecomposeFailedDto } from "../dto/decompose-failed.dto.js";
import { DecomposeNodeDto } from "../dto/decompose-node.dto.js";
import { DecomposedLeafDto } from "../dto/decomposed-leaf.dto.js";

@Action({
  name: "merge-shards-action",
  description: "Merges child shard reports into a single parent report",
  input: {
    node: DecomposeNodeDto,
    children: listOf(DecomposedLeafDto, DecomposeFailedDto),
  },
  output: DecomposedLeafDto,
})
export class MergeShardsAction implements ActionHandler<MergeShardsAction> {
  execute(input: InputOf<MergeShardsAction>): Promise<OutputOf<MergeShardsAction>> {
    const parts = input.children.map((child) =>
      "report" in child
        ? child.report
        : `FAILED(${child.nodeLabel})`,
    );
    return Promise.resolve({
      report: `${input.node.nodeLabel}: [${parts.join(", ")}]`,
    });
  }
}
