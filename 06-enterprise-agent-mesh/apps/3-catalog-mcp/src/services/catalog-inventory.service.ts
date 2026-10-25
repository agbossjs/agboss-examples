import { Injectable } from "agboss";
import type { SkuDetailsDto } from "../dto/sku-details.dto.js";

let catalogExecutionCount = 0;

export function resetCatalogExecutionCount(): void {
  catalogExecutionCount = 0;
}

export function getCatalogExecutionCount(): number {
  return catalogExecutionCount;
}

@Injectable()
export class CatalogInventoryService {
  lookup(sku: string): Promise<SkuDetailsDto> {
    catalogExecutionCount += 1;
    return Promise.resolve({
      sku,
      title: `Enterprise Rack Module (${sku})`,
      unitPriceUsd: 1250,
      inStockUnits: 14,
    });
  }
}
