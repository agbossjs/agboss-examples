import { Integer } from "@agboss/core/dto";

export class LoyaltyAdjustmentDto {
  @Integer({ prompt: "Discount amount in cents" })
  discountCents!: number;
}
