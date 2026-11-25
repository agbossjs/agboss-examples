import { Action, type ActionHandler, type InputOf, type OutputOf } from "@agboss/core";
import { OrderDraftDto } from "../dto/order-draft.dto.js";

@Action({
  name: "mutate-destination-fixed-action",
  description: "Produces a new OrderDraftDto with updated destinationCountry",
  input: { draft: OrderDraftDto },
  output: OrderDraftDto,
})
export class MutateDestinationAction implements ActionHandler<MutateDestinationAction> {
  async execute(input: InputOf<MutateDestinationAction>): Promise<OutputOf<MutateDestinationAction>> {
    return Object.assign(new OrderDraftDto(), {
      orderId: input.draft.orderId,
      subtotalCents: input.draft.subtotalCents,
      destinationCountry: input.draft.requestedCountryChange,
      requestedCountryChange: "",
    });
  }
}
