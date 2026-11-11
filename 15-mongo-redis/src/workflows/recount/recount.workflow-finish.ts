import { isVariant, listOf, oneOf, WorkflowFinish, type Produced } from "@agboss/core";
import { RecountDoneDto } from "../../dto/recount-done.dto.js";
import { ShelfCountDto } from "../../dto/shelf-count.dto.js";
import { ShelfFailedDto } from "../../dto/shelf-failed.dto.js";

@WorkflowFinish({
  name: "recount-done-workflow-finish",
  description: "Every shelf of the store, ended: counted or failed",
  input: { counts: listOf(oneOf(ShelfCountDto, ShelfFailedDto)) },
  output: RecountDoneDto,
})
export class RecountDoneWorkflowFinish {
  finish(input: {
    readonly counts: readonly Produced<ShelfCountDto | ShelfFailedDto, unknown>[];
  }): RecountDoneDto {
    const counted = input.counts.filter((count) => isVariant(count, ShelfCountDto));
    return {
      shelves: input.counts.length,
      counted: counted.length,
      items: counted.reduce((sum, count) => sum + count.value.items, 0),
      instances: new Set(counted.map((count) => count.value.instanceId)).size,
    };
  }
}
