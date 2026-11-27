import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { ShelfFailedDto } from "../dto/shelf-failed.dto.js";
import { ShelfDto } from "../dto/shelf.dto.js";

/** The failure path of a shelf: names the shelf whose count failed, for its recount. */
@Action({
  name: "mark-shelf-failed-action",
  description: "Records which shelf failed",
  input: { shelf: ShelfDto },
  output: ShelfFailedDto,
})
export class MarkShelfFailedAction implements ActionHandler<MarkShelfFailedAction> {
  execute(input: InputOf<MarkShelfFailedAction>): Promise<OutputOf<MarkShelfFailedAction>> {
    return Promise.resolve({ shelfId: input.shelf.shelfId });
  }
}
