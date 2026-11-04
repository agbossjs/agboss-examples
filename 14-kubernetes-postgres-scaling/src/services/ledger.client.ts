import { ApplicationContext, Injectable } from "@agboss/core";

/** An entry the ledger applied: the external side effect of a job. */
export interface LedgerEntryDto {
  readonly entryId: string;
  readonly jobId: string;
}

/** The ledger's answer, checked field by field. */
function entryOf(value: unknown): LedgerEntryDto {
  const { entryId, jobId } = (value ?? {}) as Record<string, unknown>;
  if (typeof entryId !== "string" || typeof jobId !== "string")
    throw new Error("the ledger answered without an entry id or a job id");
  return { entryId, jobId };
}

/**
 * The other system's ledger (`<ledgerUrl>/ledger`): `record` applies an entry once per
 * Idempotency-Key — a repeat gets the first entry back —, `find` looks a job's entry up, for
 * `reconcile` when an earlier attempt's outcome is unknown.
 */
@Injectable({ deps: [ApplicationContext] })
export class LedgerClient {
  constructor(private readonly applicationContext: ApplicationContext) {}

  async record(
    entry: { readonly jobId: string; readonly deliveredBy: string; readonly pod: string },
    options: { readonly idempotencyKey: string; readonly signal: AbortSignal },
  ): Promise<LedgerEntryDto> {
    const response = await fetch(`${this.applicationContext.environment.ledgerUrl}/ledger`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": options.idempotencyKey },
      body: JSON.stringify(entry),
      signal: options.signal,
    });
    if (!response.ok) throw new Error(`the ledger refused the entry: HTTP ${String(response.status)}`);
    return entryOf(await response.json());
  }

  async find(jobId: string, signal: AbortSignal): Promise<LedgerEntryDto | undefined> {
    const url = `${this.applicationContext.environment.ledgerUrl}/ledger?jobId=${encodeURIComponent(jobId)}`;
    const response = await fetch(url, { signal });
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`the ledger lookup failed: HTTP ${String(response.status)}`);
    return entryOf(await response.json());
  }
}
