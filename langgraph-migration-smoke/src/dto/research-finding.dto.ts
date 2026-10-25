import { Text } from "agboss/dto";

export class ResearchFindingDto {
  @Text({ prompt: "The question checked" })
  question!: string;

  @Text({ prompt: "What the order's facts say" })
  answer!: string;
}
