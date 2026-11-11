import {
  Injectable,
  type AuditLogHooks,
  type ExecutionLeaseTakeoverEvent,
  type FencedEffectEvent,
  type HookResult,
  type OutboundCallEvent,
  type StepHandedOverEvent,
} from "@agboss/core";
import { OnCallLogService } from "../services/on-call-log.service.js";

/**
 * What the on-call engineer sees of the money's safety (agbossjs/agboss#889): the four hooks of the
 * execution audit log, one line each. A takeover — another instance took a tree over; a hand-over —
 * a step stopped because its lease was lost or fenced, and the new holder goes on; a fenced effect —
 * a booking ran, was replayed or was refused; an outbound call — a charge recorded, sent, replayed or
 * reconciled. Each event's row is in `app.auditLogOf(tree)` already, written before the hook runs;
 * a hook that throws is only a warning (`observer.failed`). Identities and tokens only, never a
 * payload: an order's money stays in the stub's records.
 */
@Injectable({ deps: [OnCallLogService] })
export class PaymentAuditObserver implements AuditLogHooks {
  constructor(private readonly onCallLog: OnCallLogService) {}

  onExecutionLeaseTakeover(event: ExecutionLeaseTakeoverEvent): HookResult {
    const from = event.previousHolderInstanceId === undefined ? "" : ` from ${event.previousHolderInstanceId}`;
    this.onCallLog.write(
      `takeover ${event.reason}: ${event.holderInstanceId}${from} took tree ${event.rootExecutionId} at token ${String(event.token)}`,
    );
  }

  onStepHandedOver(event: StepHandedOverEvent): HookResult {
    this.onCallLog.write(
      `hand-over ${event.reason} at ${event.site}: ${event.step.nodeId} on ${event.holderInstanceId} stopped at token ${String(event.token)}`,
    );
  }

  onFencedEffect(event: FencedEffectEvent): HookResult {
    this.onCallLog.write(`fenced effect ${event.name} ${event.outcome} at token ${String(event.token)}`);
  }

  onOutboundCall(event: OutboundCallEvent): HookResult {
    this.onCallLog.write(
      `outbound call ${event.name} ${event.outcome} (${event.status}, attempt ${String(event.attempt)}) to ${event.target}`,
    );
  }
}
