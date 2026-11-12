import type { ShelfDto } from "./dto/shelf.dto.js";

/** A store's shelves, made up and fixed (the demo's and the tests' input): shelf i holds i + 2 scans. */
export function shelvesOf(prefix: string, count: number): ShelfDto[] {
  return Array.from({ length: count }, (_, index) => ({
    shelfId: `${prefix}-${String(index)}`,
    scans: Array.from({ length: index + 2 }, (_, scan) => `sku-${String(scan % 3)}`),
  }));
}
