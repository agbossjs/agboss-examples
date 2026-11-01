import {
  Clock,
  ExecutionContext,
  Injectable,
  SqliteFencedEffectRepository,
  TenantContext,
  fencedEffectKeyOf,
} from "@agboss/core";
import { BooksRepository } from "../repositories/books.repository.js";

/**
 * How old a payment's first attempt is — the workaround of agbossjs/agboss#658 (`reconcile` is
 * not told when the attempt was sent): the attempt's start is written once per business key — a
 * row of the shop's own (`attempt_starts`), written in a fenced effect's transaction before the call
 * — and read in `reconcile`. Not the fenced effect's stored result alone: that one is removed after
 * `fencedEffects.retention` (24 h), and the age would start again at zero. A gateway whose only lookup is a replay of
 * the key (Adyen; Stripe while its search lags) answers `notSent()` only while the key still lives.
 */
@Injectable({ deps: [SqliteFencedEffectRepository, BooksRepository, Clock, TenantContext] })
export class AttemptAgeService {
  constructor(
    private readonly sqliteFencedEffectRepository: SqliteFencedEffectRepository,
    private readonly booksRepository: BooksRepository,
    private readonly clock: Clock,
    private readonly tenantContext: TenantContext,
  ) {}

  /** When the first attempt under `businessKey` started (written now if it had not). */
  async startOf(executionContext: ExecutionContext, businessKey: string): Promise<number> {
    const key = fencedEffectKeyOf(executionContext, "attempt-start", { businessKey });
    const now = this.clock.now().getTime();
    const { result } = await this.sqliteFencedEffectRepository.saveResultIfAbsent(key, (database) =>
      this.booksRepository.attemptStart(database, this.tenantContext.tenantId, businessKey, now),
    );
    return result.startedAt;
  }

  /** Whether an attempt started at `startedAt` is still younger than the gateway's key retention. */
  isWithin(startedAt: number, retention: number): boolean {
    return this.clock.now().getTime() - startedAt < retention;
  }
}
