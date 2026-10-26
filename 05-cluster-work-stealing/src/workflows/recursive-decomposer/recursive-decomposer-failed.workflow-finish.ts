import { WorkflowFinish } from "@agboss/core";
import { DecomposeFailedDto } from "../../dto/decompose-failed.dto.js";

@WorkflowFinish({
  name: "recursive-decomposer-failed-workflow-finish",
  description: "Soft-failed recursive node",
  output: DecomposeFailedDto,
})
export class RecursiveDecomposerFailedWorkflowFinish {}
