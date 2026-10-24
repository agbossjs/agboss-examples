export interface OperationLedgerEntry {
  readonly seq: number;
  readonly service: string;
  readonly operation: "reserve" | "release" | "authorize" | "void" | "confirm";
  readonly resourceId: string;
  readonly idempotencyKey: string;
  readonly deduplicated: boolean;
}

/**
 * Verifies that compensation operations in the external ledger occurred in strict LIFO order
 * relative to their corresponding forward reservations.
 */
export function assertLifoCompensationOrder(
  entries: readonly OperationLedgerEntry[],
  expectedReleaseOrder: readonly { readonly service: string; readonly resourceId: string }[],
): void {
  const releases = entries.filter(
    (entry) =>
      (entry.operation === "release" || entry.operation === "void") && !entry.deduplicated,
  );
  const actual = releases.map((r) => ({ service: r.service, resourceId: r.resourceId }));
  if (actual.length !== expectedReleaseOrder.length) {
    throw new Error(
      `Expected ${String(expectedReleaseOrder.length)} compensation operations, got ${String(
        actual.length,
      )}: ${JSON.stringify(actual)}`,
    );
  }
  for (let i = 0; i < expectedReleaseOrder.length; i += 1) {
    const exp = expectedReleaseOrder[i];
    const act = actual[i];
    if (exp?.service !== act?.service || exp?.resourceId !== act?.resourceId) {
      throw new Error(
        `LIFO compensation order mismatch at index ${String(i)}: expected ${JSON.stringify(
          exp,
        )}, got ${JSON.stringify(act)}`,
      );
    }
  }
}

/**
 * Scans serialized traces, reports, or log strings for forbidden plaintext PII values.
 */
export function assertNoPlaintextLeak(
  artifactText: string,
  forbiddenPlaintexts: readonly string[],
  artifactLabel: string,
): void {
  for (const secretValue of forbiddenPlaintexts) {
    if (artifactText.includes(secretValue)) {
      throw new Error(
        `Plaintext PII leak detected in ${artifactLabel}: found forbidden value "${secretValue}"`,
      );
    }
  }
}
