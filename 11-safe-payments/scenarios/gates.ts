import {
  ApplicationContext,
  FencedEffectSettings,
  Injectable,
  SqliteConnection,
  SqliteFencedEffectRepository,
  SqliteOutboundCallRepository,
  StoreClock,
  type FencedEffectKey,
  type FencedEffectOutcome,
  type FencedEffectWork,
} from "@agboss/core";
import type { DatabaseSync } from "node:sqlite";
import type { TestApp } from "@agboss/core/testing";
import { StubGatewayService } from "../src/services/stub-gateway.service.js";
import { StubGatewayClient, type StubCallOptions } from "../src/stub/stub-gateway.client.js";
import type { CreateChargeRequest, StubCharge, StubMovement } from "../src/stub/stub-gateway.types.js";

/**
 * The scenarios' gates: a step held at a named point — before a request leaves the client
 * (`send:<operation>`), before an outbound call's intent is recorded (`record:<name>`), before a
 * fenced effect (`effect:<name>`) — on one instance, until the scenario lets it go. Only the
 * scenarios' overrides call them; the application never does.
 */

interface Hold {
  readonly point: string;
  readonly instanceId: string | undefined;
  times: number;
}

interface Held {
  readonly point: string;
  readonly instanceId: string;
  readonly letGo: () => void;
}

const state = { holds: [] as Hold[], held: [] as Held[], sending: 0 };

/** How many requests the gated client has let go and not yet heard back from. */
export const sendsInFlight = (): number => state.sending;

/** Runs one request of the gated client, counted while it is out. */
async function counted<T>(request: () => Promise<T>): Promise<T> {
  state.sending += 1;
  try {
    return await request();
  } finally {
    state.sending -= 1;
  }
}

/** Holds the next `times` passes of `point` (on `instanceId` only, when given). */
export function holdAt(point: string, options: { readonly instanceId?: string; readonly times?: number } = {}): void {
  state.holds.push({ point, instanceId: options.instanceId, times: options.times ?? 1 });
}

/** How many steps wait at `point` (any point when none). */
export function heldAt(point?: string): number {
  return state.held.filter((held) => point === undefined || held.point === point).length;
}

/** Lets the steps waiting at `point` go (every point when none), oldest first. */
export function letGo(point?: string): void {
  const going = state.held.filter((held) => point === undefined || held.point === point);
  state.held = state.held.filter((held) => !going.includes(held));
  for (const held of going) held.letGo();
}

/** Lets the oldest waiting step go, wherever it waits. */
export function letGoOldest(): void {
  const [oldest] = state.held.splice(0, 1);
  oldest?.letGo();
}

/** Forgets every hold and lets everything go: between scenarios. */
export function resetGates(): void {
  state.holds = [];
  letGo();
}

/** Passes `point` — or waits there, when a hold says so. */
export async function pass(point: string, instanceId: string): Promise<void> {
  const hold = state.holds.find(
    (candidate) =>
      candidate.point === point &&
      candidate.times > 0 &&
      (candidate.instanceId === undefined || candidate.instanceId === instanceId),
  );
  if (hold === undefined) return;
  hold.times -= 1;
  await new Promise<void>((resolve) => state.held.push({ point, instanceId, letGo: resolve }));
}

/** The stub's client with a gate before every money-moving request (`send:<operation>`). */
class GatedStubGatewayClient extends StubGatewayClient {
  constructor(
    baseUrl: string,
    private readonly instanceId: string,
  ) {
    super(baseUrl);
  }

  override async createCharge(request: CreateChargeRequest, options?: StubCallOptions): Promise<StubCharge> {
    await pass("send:charge", this.instanceId);
    return counted(() => super.createCharge(request, options));
  }

  override async refund(chargeId: string, amountCents: number, options?: StubCallOptions): Promise<StubMovement> {
    await pass("send:refund", this.instanceId);
    return counted(() => super.refund(chargeId, amountCents, options));
  }
}

/** `override(StubGatewayService, GatedStubGatewayService)`: the client behind its gates. */
@Injectable({ deps: [ApplicationContext] })
export class GatedStubGatewayService extends StubGatewayService {
  constructor(private readonly context: ApplicationContext) {
    super(context);
  }

  override client(): StubGatewayClient {
    return new GatedStubGatewayClient(this.context.environment.stubGatewayUrl, this.context.instanceId);
  }
}

/** `override(SqliteOutboundCallRepository, …)`: a gate before an intent is recorded (`record:<name>`). */
@Injectable({ deps: [SqliteConnection, StoreClock, ApplicationContext] })
export class GatedOutboundCallRepository extends SqliteOutboundCallRepository {
  constructor(
    connection: SqliteConnection,
    clock: StoreClock,
    private readonly context: ApplicationContext,
  ) {
    super(connection, clock);
  }

  override async saveIfAbsent(...args: Parameters<SqliteOutboundCallRepository["saveIfAbsent"]>): Promise<boolean> {
    await pass(`record:${args[0].name}`, this.context.instanceId);
    return super.saveIfAbsent(...args);
  }
}

/** `override(SqliteFencedEffectRepository, …)`: a gate before a fenced effect (`effect:<name>`). */
@Injectable({ deps: [SqliteConnection, StoreClock, FencedEffectSettings, ApplicationContext] })
export class GatedFencedEffectRepository extends SqliteFencedEffectRepository {
  constructor(
    connection: SqliteConnection,
    clock: StoreClock,
    settings: FencedEffectSettings,
    private readonly context: ApplicationContext,
  ) {
    super(connection, clock, settings);
  }

  override async saveResultIfAbsent<TResult>(
    key: FencedEffectKey,
    work: FencedEffectWork<DatabaseSync, TResult>,
  ): Promise<FencedEffectOutcome<TResult>> {
    await pass(`effect:${key.name}`, this.context.instanceId);
    return super.saveResultIfAbsent(key, work);
  }
}

/** The instance id of an app of the test (what a hold names). */
export const instanceIdOf = (app: Pick<TestApp, "resolve">): string => app.resolve(ApplicationContext).instanceId;

/** PS14's fault: the next completion of an outbound call commits, then its connection is lost. */
export const storeFaults = { lostAfterCommit: 0 };

/** `override(SqliteOutboundCallRepository, …)`: a completion that commits and then throws (PS14). */
@Injectable({ deps: [SqliteConnection, StoreClock] })
export class LostAfterCommitOutboundCallRepository extends SqliteOutboundCallRepository {
  override async markCompleted(...args: Parameters<SqliteOutboundCallRepository["markCompleted"]>): Promise<boolean> {
    const committed = await super.markCompleted(...args);
    if (storeFaults.lostAfterCommit > 0) {
      storeFaults.lostAfterCommit -= 1;
      throw new Error("the connection to the database was lost after the commit");
    }
    return committed;
  }
}
