import { WorkflowFinish, type Produced } from "@agboss/core";
import { ShelfFailedDto } from "../../dto/shelf-failed.dto.js";
import { ShelfDto } from "../../dto/shelf.dto.js";

/** Where a shelf whose step failed ends: the recount counts it as failed and goes on with the rest. */
@WorkflowFinish({
  name: "shelf-failed-workflow-finish",
  description: "The shelf's count failed; the recount goes on without it",
  input: { shelf: ShelfDto },
  output: ShelfFailedDto,
})
export class ShelfFailedWorkflowFinish {
  finish(input: { readonly shelf: Produced<ShelfDto, unknown> }): ShelfFailedDto {
    return { shelfId: input.shelf.value.shelfId };
  }
}
