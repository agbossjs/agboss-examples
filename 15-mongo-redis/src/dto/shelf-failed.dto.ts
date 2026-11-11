import { Text } from "@agboss/core/dto";

/** A shelf whose count failed: it ended at its own failure finish, and the recount went on. */
export class ShelfFailedDto {
  @Text({ prompt: "the shelf's id" })
  shelfId!: string;
}
