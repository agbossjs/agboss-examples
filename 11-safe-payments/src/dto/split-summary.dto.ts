import { Integer } from "@agboss/core/dto";

/** What a split order charged in all. */
export class SplitSummaryDto {
  @Integer({ prompt: "how many parts were charged" })
  parts!: number;

  @Integer({ prompt: "the total charged, in cents" })
  totalCents!: number;
}
