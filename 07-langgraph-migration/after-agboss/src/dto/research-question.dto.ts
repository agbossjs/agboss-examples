import { Text } from "agboss/dto";

export class ResearchQuestionDto {
  @Text({ prompt: "One thing to check before answering" })
  question!: string;
}
