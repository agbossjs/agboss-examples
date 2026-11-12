import { Integer, Text } from "@agboss/core/dto";

/** One shelf, counted: how many items and distinct codes, and which instance counted it. */
export class ShelfCountDto {
  @Text({ prompt: "the shelf's id" })
  shelfId!: string;

  @Integer({ prompt: "the items scanned" })
  items!: number;

  @Integer({ prompt: "the distinct item codes" })
  codes!: number;

  @Text({ prompt: "the application instance that counted the shelf" })
  instanceId!: string;
}
