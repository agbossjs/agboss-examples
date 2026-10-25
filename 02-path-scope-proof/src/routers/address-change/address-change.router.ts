import {
  DecidedBy,
  type InputOf,
  type Route,
  Router,
  type RouterHandler,
} from "agboss";
import { ComputeTaxAction } from "../../actions/compute-tax.action.js";
import { MutateDestinationAction } from "../../actions/mutate-destination.action.js";
import { OrderDraftDto } from "../../dto/order-draft.dto.js";

@Router({
  name: "address-change-fixed-router",
  description: "Routes orders with a requested destination change to MutateDestinationAction",
  decidedBy: DecidedBy.Code,
  input: { draft: OrderDraftDto },
  routes: [{ target: MutateDestinationAction }, { target: ComputeTaxAction }],
})
export class AddressChangeRouter implements RouterHandler<AddressChangeRouter> {
  route(input: InputOf<AddressChangeRouter>): Route<AddressChangeRouter> {
    return input.draft.value.requestedCountryChange !== ""
      ? MutateDestinationAction
      : ComputeTaxAction;
  }
}
