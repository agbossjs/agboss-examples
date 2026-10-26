import { Text } from "@agboss/core/dto";

/** The reviewer's approval: the variant is the decision, so it needs no boolean flag. */
export class ReplyApprovedDto {
  @Text({ prompt: "A note for the record", optional: true })
  note?: string;
}
