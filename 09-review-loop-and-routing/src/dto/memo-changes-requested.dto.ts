import { Text } from "@agboss/core/dto";

/** The risk officer's verdict "rewrite it": what to change in the memo. */
export class MemoChangesRequestedDto {
  @Text({ prompt: "what to change in the memo, concretely" })
  notes!: string;
}
