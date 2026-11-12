import { Integer } from "@agboss/core/dto";

/** A recount, ended: how many shelves, how many counted, their items, on how many instances. */
export class RecountDoneDto {
  @Integer({ prompt: "the shelves of the recount" })
  shelves!: number;

  @Integer({ prompt: "the shelves counted (the rest ended at their failure finish)" })
  counted!: number;

  @Integer({ prompt: "the items counted over every counted shelf" })
  items!: number;

  @Integer({ prompt: "the instances that counted a shelf" })
  instances!: number;
}
