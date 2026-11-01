import { WorkflowStart, listOf } from "@agboss/core";
import { WalletDrawDto } from "../../dto/wallet-draw.dto.js";

@WorkflowStart({ name: "split-order-workflow-start", description: "PS9: a split order, its parts drawn on one wallet", input: listOf(WalletDrawDto) })
export class SplitOrderWorkflowStart {}
