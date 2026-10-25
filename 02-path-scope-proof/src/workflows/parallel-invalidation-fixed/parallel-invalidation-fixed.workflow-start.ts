import { WorkflowStart } from "agboss";
import { CartRequestDto } from "../../dto/cart-request.dto.js";

@WorkflowStart({
  name: "parallel-invalidation-fixed-workflow-start",
  description: "Starts fixed parallel invalidation workflow",
  input: CartRequestDto,
})
export class ParallelInvalidationFixedStart {}
