import { Decimal, Integer, Text } from "agboss/dto";

export class SkuDetailsDto {
  @Text({ prompt: "Product SKU code" })
  sku!: string;

  @Text({ prompt: "Product title" })
  title!: string;

  @Decimal({ prompt: "Unit price in USD", min: 0 })
  unitPriceUsd!: number;

  @Integer({ prompt: "Units currently in stock", min: 0 })
  inStockUnits!: number;
}
