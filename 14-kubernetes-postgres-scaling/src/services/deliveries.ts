import type { FencedEffectKey } from "@agboss/core";

/** A job's receipt: what its delivery stores, once. */
export interface Receipt {
  readonly jobId: string;
  readonly instanceId: string;
  readonly pod: string;
  readonly token: number;
}

/**
 * The job's protected write: the receipt stored once per key by the application's fenced-effect
 * store (#500), in that store's own transaction, checked against the step's lease. One
 * implementation per store set — `PostgresDeliveries` in the cluster, `SqliteDeliveries` locally —
 * each a line over the store, listed in its application's `providers`.
 */
export abstract class Deliveries {
  abstract deliverOnce(key: FencedEffectKey, receipt: Receipt): Promise<Receipt>;
}
