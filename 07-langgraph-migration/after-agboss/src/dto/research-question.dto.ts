import { Text } from "@agboss/core/dto";

export class ResearchQuestionDto {
  @Text({ prompt: "One thing to check before answering" })
  question!: string;
}
