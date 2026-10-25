import { WorkflowStart } from "agboss";
import { DecomposeNodeDto } from "../../dto/decompose-node.dto.js";

@WorkflowStart({
  name: "recursive-decomposer-workflow-start",
  description: "Recursively decomposes a cluster shard task up to maxDepth",
  input: DecomposeNodeDto,
})
export class RecursiveDecomposerWorkflowStart {}
