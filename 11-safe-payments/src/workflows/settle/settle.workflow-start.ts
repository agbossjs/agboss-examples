import { WorkflowStart } from "@agboss/core";
import { DispositionRequestDto } from "../../dto/disposition-request.dto.js";

@WorkflowStart({ name: "settle-workflow-start", description: "PS20: fulfilment captures the whole authorization", input: DispositionRequestDto })
export class SettleWorkflowStart {}
