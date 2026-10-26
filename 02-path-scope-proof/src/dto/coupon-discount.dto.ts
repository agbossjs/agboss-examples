import { Integer, Text } from "@agboss/core/dto";

export class CouponDiscountDto {
  @Text({ prompt: "Coupon code" })
  code!: string;

  @Integer({ prompt: "Discount amount in cents" })
  discountCents!: number;
}
