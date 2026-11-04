import { Injectable, type FencedEffectKey } from "@agboss/core";
import { PostgresFencedEffectRepository } from "@agboss/postgres";
import { Deliveries, type Receipt } from "./deliveries.js";

/** The receipt in PostgreSQL's fenced-effect store (`@agboss/postgres`): the cluster's delivery. */
@Injectable({ deps: [PostgresFencedEffectRepository] })
export class PostgresDeliveries extends Deliveries {
  constructor(private readonly postgresFencedEffectRepository: PostgresFencedEffectRepository) {
    super();
  }

  async deliverOnce(key: FencedEffectKey, receipt: Receipt): Promise<Receipt> {
    const { result } = await this.postgresFencedEffectRepository.saveResultIfAbsent(key, () => ({ ...receipt }));
    return result;
  }
}
