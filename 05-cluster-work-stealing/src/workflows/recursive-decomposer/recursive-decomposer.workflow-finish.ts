import { WorkflowFinish } from "agboss";
import { DecomposedLeafDto } from "../../dto/decomposed-leaf.dto.js";

@WorkflowFinish({
  name: "recursive-decomposer-workflow-finish",
  description: "Completed recursive decomposition report",
  output: DecomposedLeafDto,
})
export class RecursiveDecomposerWorkflowFinish {}
