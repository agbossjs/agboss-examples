import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { OperationLedgerEntry } from "../../../tooling/assertions/execution-events.js";

export interface LedgerSnapshot {
  readonly nextSeq: number;
  readonly entries: readonly OperationLedgerEntry[];
  readonly resultsByKey: Readonly<Record<string, unknown>>;
  readonly resourceStates: Readonly<Record<string, string>>;
}

interface MutableLedgerState {
  nextSeq: number;
  entries: OperationLedgerEntry[];
  resultsByKey: Map<string, unknown>;
  resourceStates: Map<string, string>;
  failCancelOnceBookings: Set<string>;
  persistenceFilePath: string | undefined;
}

const state: MutableLedgerState = {
  nextSeq: 1,
  entries: [],
  resultsByKey: new Map<string, unknown>(),
  resourceStates: new Map<string, string>(),
  failCancelOnceBookings: new Set<string>(),
  persistenceFilePath: undefined,
};

function persistIfNeeded(): void {
  if (state.persistenceFilePath === undefined) {
    return;
  }
  const snapshot: LedgerSnapshot = {
    nextSeq: state.nextSeq,
    entries: state.entries,
    resultsByKey: Object.fromEntries(state.resultsByKey.entries()),
    resourceStates: Object.fromEntries(state.resourceStates.entries()),
  };
  writeFileSync(state.persistenceFilePath, JSON.stringify(snapshot, null, 2), "utf8");
}

export function configureLedgerFile(filePath: string | undefined): void {
  state.persistenceFilePath = filePath;
  if (filePath !== undefined && existsSync(filePath)) {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as LedgerSnapshot;
    state.nextSeq = parsed.nextSeq;
    state.entries = [...parsed.entries];
    state.resultsByKey = new Map(Object.entries(parsed.resultsByKey));
    state.resourceStates = new Map(Object.entries(parsed.resourceStates));
  }
}

export function resetOperationLedger(): void {
  state.nextSeq = 1;
  state.entries = [];
  state.resultsByKey.clear();
  state.resourceStates.clear();
  state.failCancelOnceBookings.clear();
  persistIfNeeded();
}

export function injectTransientCancelFailureOnce(bookingId: string): void {
  state.failCancelOnceBookings.add(bookingId);
}

export function shouldFailCancelOnce(bookingId: string): boolean {
  if (state.failCancelOnceBookings.has(bookingId)) {
    state.failCancelOnceBookings.delete(bookingId);
    return true;
  }
  return false;
}

export function recordIdempotentOperation<T>(params: {
  readonly service: string;
  readonly operation: OperationLedgerEntry["operation"];
  readonly resourceId: string;
  readonly idempotencyKey: string;
  readonly nextResourceState: string;
  readonly computeResult: () => T;
}): T {
  const compositeKey = `${params.service}:${params.operation}:${params.idempotencyKey}`;
  if (state.resultsByKey.has(compositeKey)) {
    const existing = state.resultsByKey.get(compositeKey) as T;
    state.entries.push({
      seq: state.nextSeq++,
      service: params.service,
      operation: params.operation,
      resourceId: params.resourceId,
      idempotencyKey: params.idempotencyKey,
      deduplicated: true,
    });
    persistIfNeeded();
    return existing;
  }

  const computed = params.computeResult();
  state.resultsByKey.set(compositeKey, computed);
  state.resourceStates.set(`${params.service}:${params.resourceId}`, params.nextResourceState);
  state.entries.push({
    seq: state.nextSeq++,
    service: params.service,
    operation: params.operation,
    resourceId: params.resourceId,
    idempotencyKey: params.idempotencyKey,
    deduplicated: false,
  });
  persistIfNeeded();
  return computed;
}

export function getOperationLedgerEntries(): readonly OperationLedgerEntry[] {
  return [...state.entries];
}

export function getResourceState(service: string, resourceId: string): string | undefined {
  return state.resourceStates.get(`${service}:${resourceId}`);
}
