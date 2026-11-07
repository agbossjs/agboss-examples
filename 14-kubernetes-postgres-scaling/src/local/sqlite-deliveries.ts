import { Injectable, SqliteFencedEffectRepository, type EffectKey } from "@agboss/core";
import { Deliveries, type Receipt } from "../services/deliveries.js";

/** The receipt in the SQLite fenced-effect store: the local application's delivery. */
@Injectable({ deps: [SqliteFencedEffectRepository] })
export class SqliteDeliveries extends Deliveries {
  constructor(private readonly sqliteFencedEffectRepository: SqliteFencedEffectRepository) {
    super();
  }

  async deliverOnce(key: EffectKey, receipt: Receipt): Promise<Receipt> {
    const { result } = await this.sqliteFencedEffectRepository.saveResultIfAbsent(key, () => ({ ...receipt }));
    return result;
  }
}
