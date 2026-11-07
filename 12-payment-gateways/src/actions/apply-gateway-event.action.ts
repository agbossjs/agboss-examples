import {
  Action,
  ExecutionContext,
  SqliteFencedEffectRepository,
  TenantContext,
  effectKeyOf,
  type ActionHandler,
  type InputOf,
  type OutputOf,
} from "@agboss/core";
import { GatewayEventDto } from "../dto/gateway-event.dto.js";
import { MovementDto } from "../dto/movement.dto.js";
import { BooksRepository } from "../repositories/books.repository.js";
import { PaymentBooksService } from "../services/payment-books.service.js";

/** Applies one gateway event once: a fenced effect under the gateway's own event id. */
@Action({
  name: "apply-gateway-event-action",
  description: "Applies a gateway event to the shop's books, once per event",
  input: { event: GatewayEventDto },
  output: MovementDto,
  deps: [ExecutionContext, SqliteFencedEffectRepository, BooksRepository, PaymentBooksService, TenantContext],
})
export class ApplyGatewayEventAction implements ActionHandler<ApplyGatewayEventAction> {
  constructor(
    private readonly executionContext: ExecutionContext,
    private readonly sqliteFencedEffectRepository: SqliteFencedEffectRepository,
    private readonly booksRepository: BooksRepository,
    private readonly paymentBooksService: PaymentBooksService,
    private readonly tenantContext: TenantContext,
  ) {}

  async execute(input: InputOf<ApplyGatewayEventAction>): Promise<OutputOf<ApplyGatewayEventAction>> {
    const event = input.event.value;
    // verified for this tenant: an event about another tenant's (or another order's) payment applies nothing
    this.paymentBooksService.assertOrdersPayment(event.orderId, event.paymentId);
    const { tenantId } = this.tenantContext;
    const key = effectKeyOf(this.executionContext, "apply-event", { businessKey: `event:${event.eventId}` });
    const { status } = await this.sqliteFencedEffectRepository.saveResultIfAbsent(key, (database) =>
      this.booksRepository.apply(database, tenantId, event),
    );
    return { movementId: event.eventId, status };
  }
}
