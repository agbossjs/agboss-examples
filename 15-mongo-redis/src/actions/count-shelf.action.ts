import {
  Action,
  ApplicationContext,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { ShelfCountDto } from "../dto/shelf-count.dto.js";
import { ShelfDto } from "../dto/shelf.dto.js";

/**
 * One shelf, counted (agbossjs/agboss#891): pure code over the step's input — no model, no call out.
 * It runs on whichever instance claimed the shelf's child from the Redis queue, under that tree's
 * Redis lease; a crash mid-step runs it again on another instance from its last Mongo checkpoint,
 * which is safe because it has no effect outside the execution. An effect that must happen once (a
 * charge, a message) needs a fenced-effect or outbound-call store checked in one transaction with the
 * lease — which Redis leases cannot give, so this application lists neither (the core refuses one at
 * assembly, `[application.store-backend-mismatch]`): such work runs on MongoDB leases instead.
 */
@Action({
  name: "count-shelf-action",
  description: "Counts the items and distinct codes of one shelf",
  input: { shelf: ShelfDto },
  output: ShelfCountDto,
  deps: [ApplicationContext],
})
export class CountShelfAction implements ActionHandler<CountShelfAction> {
  constructor(private readonly applicationContext: ApplicationContext) {}

  execute(input: InputOf<CountShelfAction>): Promise<OutputOf<CountShelfAction>> {
    const { shelfId, scans } = input.shelf.value;
    return Promise.resolve({
      shelfId,
      items: scans.length,
      codes: new Set(scans).size,
      instanceId: this.applicationContext.instanceId,
    });
  }
}
