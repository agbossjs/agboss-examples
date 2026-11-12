import { ListOf, Text } from "@agboss/core/dto";

/** One shelf of a store to recount: a child workflow on any instance. */
export class ShelfDto {
  @Text({ prompt: "the shelf's id" })
  shelfId!: string;

  @ListOf(Text, { prompt: "the item codes scanned on the shelf, one per item" })
  scans!: string[];
}
