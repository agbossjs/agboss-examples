import { Agent, oneOf } from "agboss";
import { DecomposeNodeDto } from "../../dto/decompose-node.dto.js";
import { DecomposeSplitDecisionDto } from "../../dto/decompose-split-decision.dto.js";
import { DecomposedLeafDto } from "../../dto/decomposed-leaf.dto.js";

@Agent({
  name: "shard-analyzer-agent",
  description:
    "Completes a shard directly as DecomposedLeafDto or requests a recursive split via DecomposeSplitDecisionDto",
  promptUrls: ["./shard-analyzer.prompt.md"],
  model: "openai/gpt-4o-mini",
  input: { node: DecomposeNodeDto },
  output: oneOf(DecomposedLeafDto, DecomposeSplitDecisionDto),
})
export class ShardAnalyzerAgent {}
