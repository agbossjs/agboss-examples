import { Text } from "agboss/dto";

export class ChangesRequestedDto {
  @Text({ prompt: "What to change in the reply" })
  notes!: string;
}
