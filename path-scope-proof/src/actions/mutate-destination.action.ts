import { Action, type ActionHandler, type InputOf, type OutputOf } from "agboss";
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
      orderId: input.draft.value.orderId,
      subtotalCents: input.draft.value.subtotalCents,
      destinationCountry: input.draft.value.requestedCountryChange,
      requestedCountryChange: "",
    });
  }
}
