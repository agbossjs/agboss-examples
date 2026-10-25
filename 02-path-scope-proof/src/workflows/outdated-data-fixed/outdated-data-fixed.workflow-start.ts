import { WorkflowStart } from "agboss";
import { OrderDraftDto } from "../../dto/order-draft.dto.js";

@WorkflowStart({
  name: "outdated-data-fixed-workflow-start",
  description: "Starts fixed outdated-data workflow",
  input: OrderDraftDto,
})
export class OutdatedDataFixedStart {}
