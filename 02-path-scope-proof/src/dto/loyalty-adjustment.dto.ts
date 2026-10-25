import { Integer } from "agboss/dto";

export class LoyaltyAdjustmentDto {
  @Integer({ prompt: "Discount amount in cents" })
  discountCents!: number;
}
