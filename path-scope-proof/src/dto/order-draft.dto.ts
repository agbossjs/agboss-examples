import { Integer, Text } from "agboss/dto";

export class OrderDraftDto {
  @Text({ prompt: "Order identifier" })
  orderId!: string;

  @Integer({ prompt: "Subtotal in cents" })
  subtotalCents!: number;

  @Text({ prompt: "Current destination country code" })
  destinationCountry!: string;

  @Text({ prompt: "Requested country change (empty if none)" })
  requestedCountryChange!: string;
}
