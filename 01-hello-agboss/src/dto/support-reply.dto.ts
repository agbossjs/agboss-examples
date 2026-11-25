import { Float, Text } from "@agboss/core/dto";

export class SupportReplyDto {
  @Text({ prompt: "department that handled the inquiry (support | pricing)" })
  handledBy!: string;

  @Text({ prompt: "final response message to the customer", minLength: 1 })
  answer!: string;

  @Float({ prompt: "quoted monthly amount in USD (0 for general non-pricing inquiries)", min: 0 })
  quotedMonthlyUsd!: number;
}
