import {
  Action,
  ExecutionContext,
  SqliteFencedEffectRepository,
  fencedEffectKeyOf,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { GatewayEventDto } from "../dto/gateway-event.dto.js";
import { MovementDto } from "../dto/movement.dto.js";
import { BooksRepository } from "../repositories/books.repository.js";

/** Applies one gateway event once: a fenced effect under the gateway's own event id. */
@Action({
  name: "apply-gateway-event-action",
  description: "Applies a gateway event to the shop's books, once per event",
  input: { event: GatewayEventDto },
  output: MovementDto,
  deps: [ExecutionContext, SqliteFencedEffectRepository, BooksRepository],
})
export class ApplyGatewayEventAction implements ActionHandler<ApplyGatewayEventAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly sqliteFencedEffectRepository: SqliteFencedEffectRepository,
    private readonly booksRepository: BooksRepository,
  ) {}

  async execute(input: InputOf<ApplyGatewayEventAction>): Promise<OutputOf<ApplyGatewayEventAction>> {
    const event = input.event.value;
    const key = fencedEffectKeyOf(this.executionContext, "apply-event", { businessKey: `event:${event.eventId}` });
    const { status } = await this.sqliteFencedEffectRepository.saveResultIfAbsent(key, (database) =>
      this.booksRepository.apply(database, event),
    );
    return { movementId: event.eventId, status };
  }
}
