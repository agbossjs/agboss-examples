// Independent example, not affiliated. CardCom is named only to identify its public API. AGBoss is
// not affiliated with, endorsed by or sponsored by CardCom; the name is its owner's trademark. This
// example follows CardCom's public documentation as read on 2026-11-01
// (https://secure.cardcom.solutions/api/v11/docs). Gateways change their APIs and SDKs: check the
// official documentation before relying on it.
import { createHash } from "node:crypto";
import { ExecutionContext, Injectable, OutboundCallReconciliation, OutboundCalls, fencedEffectKeyOf } from "@agboss/core";
import { GatewayPayments, type GatewayMovement, type GatewayOrder, type GatewayPayment, type GatewayRefund } from "../../gateway-payments.js";
import { GatewayStubService } from "../../services/gateway-stub.service.js";

const TERMINAL = { TerminalNumber: 1000, ApiName: "offline-placeholder" };

/** CardCom takes 25 characters: the first 25 of the key's SHA-256 in base64url (150 bits), never a cut of the key. */
const externalIdOf = (idempotencyKey: string): string => createHash("sha256").update(idempotencyKey).digest("base64url").slice(0, 25);

/** CardCom has no official Node SDK: its documented HTTP API v11, by `fetch`. */
@Injectable({ deps: [OutboundCalls, GatewayStubService] })
export class CardcomGatewayPayments extends GatewayPayments {
  constructor(
    private readonly outboundCalls: OutboundCalls,
    private readonly gatewayStubService: GatewayStubService,
  ) {
    super();
  }

  private async post(path: string, body: object): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.gatewayStubService.baseUrl()}/api/v11/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...TERMINAL, ...body }) });
    if (!response.ok) throw new Error(`CardCom answered HTTP ${String(response.status)}`);
    return (await response.json()) as Record<string, unknown>;
  }

  override async charge(executionContext: ExecutionContext, order: GatewayOrder): Promise<GatewayPayment> {
    const key = fencedEffectKeyOf(executionContext, "charge", { businessKey: `order:${order.orderId}` });
    const { result } = await this.outboundCalls.send(key, {
      target: "cardcom",
      operation: "Transactions/Transaction",
      request: { Amount: order.amountCents / 100, ReturnValue: order.orderId, Token: "offline-token" },
      send: async (call) => {
        // ExternalUniqUniqTranIdResponse: true — a repeat returns the original answer, not error 608
        const answer = await this.post("Transactions/Transaction", { ...call.request, ExternalUniqTranId: externalIdOf(call.idempotencyKey), ExternalUniqUniqTranIdResponse: true });
        if (answer["ResponseCode"] !== 0) throw new Error(`CardCom refused the charge: ${String(answer["ResponseCode"])}`);
        return { paymentId: String(answer["TranzactionId"]), amountCents: order.amountCents, status: "approved" };
      },
      reconcile: async (lookup) => {
        const found = await this.post("Transactions/GetTransactionByExternalUniqTran", { ExternalUniqTranId: externalIdOf(lookup.idempotencyKey) });
        const info = found["TranzactionInfo"] as { TranzactionId?: unknown } | undefined;
        return found["ResponseCode"] === 0 && info !== undefined
          ? OutboundCallReconciliation.completed({ paymentId: String(info.TranzactionId), amountCents: order.amountCents, status: "approved" })
          : OutboundCallReconciliation.notSent();
      },
    });
    return result;
  }

  /** Refunds take no key at CardCom: AGBoss never resends one blindly; one whose answer is lost is unknown, for a person. */
  override async refund(executionContext: ExecutionContext, refund: GatewayRefund): Promise<GatewayMovement> {
    const key = fencedEffectKeyOf(executionContext, "refund", { businessKey: `refund:${refund.paymentId}:${String(refund.refundNumber)}` });
    const { result } = await this.outboundCalls.send(key, {
      target: "cardcom",
      operation: "Transactions/RefundByTransactionId",
      request: { TransactionId: Number(refund.paymentId), PartialSum: refund.amountCents / 100, AllowMultipleRefunds: true },
      send: async (call) => {
        const answer = await this.post("Transactions/RefundByTransactionId", call.request);
        if (answer["ResponseCode"] !== 0) throw new Error(`CardCom refused the refund: ${String(answer["ResponseCode"])}`);
        return { movementId: String(answer["NewTranzactionId"]), status: "refunded" };
      },
      reconcile: () => OutboundCallReconciliation.unknown({ reason: "CardCom refunds take no key and have no lookup: check the terminal's report" }),
    });
    return result;
  }
}
