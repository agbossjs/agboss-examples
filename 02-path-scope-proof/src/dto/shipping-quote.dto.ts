import { Integer, Text } from "@agboss/core/dto";

export class ShippingQuoteDto {
  @Integer({ prompt: "Shipping cost in cents" })
  shippingCents!: number;

  @Text({ prompt: "Country code the quote was calculated for" })
  quotedForCountry!: string;
}
