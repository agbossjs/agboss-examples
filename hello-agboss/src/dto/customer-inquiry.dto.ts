import { Integer, Text } from "agboss/dto";

export class CustomerInquiryDto {
  @Text({ prompt: "customer identifier", minLength: 1 })
  customerId!: string;

  @Text({ prompt: "the customer's question or pricing request", minLength: 1 })
  question!: string;

  @Integer({ prompt: "requested seat count when asking for pricing", min: 1, max: 1000 })
  seats!: number;
}
