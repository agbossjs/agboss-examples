import { Action, listOf, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { RecountDoneDto } from "../dto/recount-done.dto.js";
import { ShelfCountDto } from "../dto/shelf-count.dto.js";
import { ShelfFailedDto } from "../dto/shelf-failed.dto.js";

/** The recount's totals from every shelf's own finish: a count is a shelf counted, the rest failed. */
@Action({
  name: "summarize-recount-action",
  description: "Adds up the shelves counted, their items and the instances that counted them",
  input: { counts: listOf(ShelfCountDto, ShelfFailedDto) },
  output: RecountDoneDto,
})
export class SummarizeRecountAction implements ActionHandler<SummarizeRecountAction> {
  execute(input: InputOf<SummarizeRecountAction>): Promise<OutputOf<SummarizeRecountAction>> {
    const counted = input.counts.filter((count) => "instanceId" in count);
    return Promise.resolve({
      shelves: input.counts.length,
      counted: counted.length,
      items: counted.reduce((sum, count) => sum + count.items, 0),
      instances: new Set(counted.map((count) => count.instanceId)).size,
    });
  }
}
