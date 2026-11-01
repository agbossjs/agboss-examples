import { Text } from "@agboss/core/dto";

/** The risk officer's verdict "approve it": a marker, with an optional note for the record. */
export class MemoApprovedDto {
  @Text({ prompt: "a note for the record", optional: true })
  note?: string;
}
