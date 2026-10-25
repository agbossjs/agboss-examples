import { Text } from "agboss/dto";

export class OrderFactsDto {
  @Text({ prompt: "What is known about the order" })
  facts!: string;
}
