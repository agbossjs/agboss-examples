import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp, type ExecutionStreamEvent } from "@agboss/core";
import { HelloAgbossApplication } from "../../src/hello-agboss.application.js";
import { HelloAgbossGatewayApplication } from "../../src/hello-agboss.gateway.app.js";
import { StreamingAnswerWorkflowStart } from "../../src/workflows/streaming-answer/streaming-answer.workflow-start.js";

/** A request the stub got. */
export interface StubRequest {
  readonly method: string;
  readonly url: string;
  readonly body: Record<string, unknown>;
}

/** A local server on 127.0.0.1: the requests it got, and `close`. */
export interface Stub {
  readonly url: string;
  readonly requests: StubRequest[];
  close(): Promise<void>;
}

/** The test waits at a gate until it opens it: the stub holds its next chunk there. */
export class Gate {
  #open: () => void = () => undefined;
  readonly opened = new Promise<void>((resolve) => {
    this.#open = resolve;
  });

  open(): void {
    this.#open();
  }
}

function bodyOf(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const parts: Buffer[] = [];
    request.on("data", (part: Buffer) => parts.push(part));
    request.on("end", () => {
      const parsed: unknown = JSON.parse(Buffer.concat(parts).toString("utf8") || "{}");
      resolve(
        typeof parsed === "object" && parsed !== null
          ? Object.fromEntries(Object.entries(parsed))
          : {},
      );
    });
  });
}

/** Starts a stub on a free port; `respond` answers each request it records. */
export async function startStub(
  respond: (request: StubRequest, response: ServerResponse) => Promise<void> | void,
): Promise<Stub> {
  const requests: StubRequest[] = [];
  const server = createServer((incoming, response) => {
    void (async () => {
      const request = {
        method: incoming.method ?? "GET",
        url: incoming.url ?? "",
        body: await bodyOf(incoming),
      };
      requests.push(request);
      await respond(request, response);
    })();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${String(port)}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => {
          resolve();
        });
      }),
  };
}

/** Lets the event loop turn, so a socket write reaches the other side. */
export const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const OPTIONS = {
  ownerId: "user-stream-1",
  tenant: { tenantId: "tenant-acme", plan: "pro" as const },
  execution: { userId: "user-stream-1" },
};

/**
 * One execution of the streaming workflow on `application`; every event `onStream` hears goes to
 * `events` (also when the run fails, so a test sees what was shown before the failure).
 */
export async function askStreamed(
  application: typeof HelloAgbossApplication | typeof HelloAgbossGatewayApplication,
  question: string,
  events: ExecutionStreamEvent[],
  onEvent: (event: ExecutionStreamEvent) => void = () => undefined,
) {
  const app = await createApp(application);
  try {
    return await app.execute(
      StreamingAnswerWorkflowStart,
      { text: question },
      {
        ...OPTIONS,
        onStream: (event) => {
          events.push(event);
          onEvent(event);
        },
      },
    );
  } finally {
    await app.close();
  }
}

/** The text the widget would show: the deltas, joined. */
export const textOf = (events: readonly ExecutionStreamEvent[]): string =>
  events.map((event) => (event.kind === "textDelta" ? event.delta : "")).join("");
