import { Text } from "@agboss/core/dto";

export class SkuLookupInputDto {
  @Text({ prompt: "Product SKU code (e.g. SKU-GPU-900)" })
  sku!: string;
}
