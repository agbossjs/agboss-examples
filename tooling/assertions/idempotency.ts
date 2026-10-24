import type { OperationLedgerEntry } from "./execution-events.js";

/**
 * Asserts that no external side effect (reserve, release, authorize, void, confirm) was applied
 * more than once for the same resource and operation type when idempotency keys are honored.
 */
export function assertNoDuplicateSideEffects(entries: readonly OperationLedgerEntry[]): void {
  const applied = entries.filter((entry) => !entry.deduplicated);
  const seen = new Set<string>();
  for (const entry of applied) {
    const key = `${entry.service}:${entry.operation}:${entry.resourceId}`;
    if (seen.has(key)) {
      throw new Error(
        `Duplicate external business side effect detected for "${key}" (idempotencyKey=${entry.idempotencyKey})`,
      );
    }
    seen.add(key);
  }
}

/**
 * Asserts that every non-empty idempotency key passed to an external service is deterministic
 * and non-blank.
 */
export function assertIdempotencyKeysPresent(entries: readonly OperationLedgerEntry[]): void {
  for (const entry of entries) {
    if (entry.idempotencyKey.trim() === "") {
      throw new Error(
        `Missing idempotencyKey on ${entry.service}.${entry.operation} (${entry.resourceId})`,
      );
    }
  }
}
