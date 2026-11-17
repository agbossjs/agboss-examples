import type { ServerResponse } from "node:http";
import { ExecutionStatus, type ExecutionStreamEvent } from "@agboss/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HelloAgbossGatewayApplication } from "../../src/hello-agboss.gateway.app.js";
import { askStreamed, Gate, startStub, textOf, tick, type Stub } from "./stub-server.js";

/** What the gateway's `/stream` writes: one JSON line per token, the usage as the last line. */
const line = (value: Record<string, unknown>): string => `${JSON.stringify(value)}\n`;
const USAGE = { inputTokens: 1_000, outputTokens: 200 };
/** 1000 input and 200 output tokens at $0.15 and $0.60 per million. */
const USAGE_USD = 0.00027;

const TOKENS = ["Your", " invoice", " was", " credited."];

describe("GatewayStreamModelProvider: a transport that streams (#1011)", () => {
  let gateway: Stub;
  const events: ExecutionStreamEvent[] = [];

  beforeEach(() => {
    events.length = 0;
  });
  afterEach(async () => {
    delete process.env.LLM_GATEWAY_BASE_URL;
    await gateway.close();
  });

  async function serve(
    respond: (response: ServerResponse, attempt: number) => Promise<void> | void,
  ): Promise<void> {
    let attempt = 0;
    gateway = await startStub(async (_request, response) => {
      attempt += 1;
      response.writeHead(200, { "content-type": "application/x-ndjson" });
      await respond(response, attempt);
    });
    process.env.LLM_GATEWAY_BASE_URL = gateway.url;
  }

  it("every token the gateway writes is a textDelta of onStream, before the answer is complete", async () => {
    const afterFirstToken = new Gate();
    await serve(async (response) => {
      response.write(line({ token: TOKENS[0] }));
      // the gateway holds the rest until the widget has the first token: nothing buffered until the end
      await afterFirstToken.opened;
      for (const token of TOKENS.slice(1)) {
        response.write(line({ token }));
        await tick();
      }
      response.end(line({ usage: USAGE }));
    });

    const result = await askStreamed(
      HelloAgbossGatewayApplication,
      "Was my invoice credited?",
      events,
      (event) => {
        if (event.kind === "textDelta") afterFirstToken.open();
      },
    );

    const deltas = events.flatMap((event) => (event.kind === "textDelta" ? [event.delta] : []));
    expect(deltas).toEqual(TOKENS);
    expect(result.status).toBe(ExecutionStatus.Finished);
    expect(result.output).toEqual({ text: TOKENS.join("") });
    expect(textOf(events)).toBe(result.output?.text);
  }, 15_000);

  it("the usage line is the call's usage: tokens times the price table, counted once", async () => {
    await serve((response) => {
      for (const token of TOKENS) response.write(line({ token }));
      response.end(line({ usage: USAGE }));
    });

    const result = await askStreamed(HelloAgbossGatewayApplication, "Credit?", events);

    expect(result.spend.calls).toBe(1);
    expect(result.spend.totalUsd).toBeCloseTo(USAGE_USD, 9);
    expect(result.spend.trace).toEqual([
      expect.objectContaining({
        model: "openai/gpt-4o-mini",
        inputTokens: 1_000,
        outputTokens: 200,
        costSource: "price-table",
      }),
    ]);
    expect(gateway.requests).toHaveLength(1);
  });

  it("a failure before the first token is retried: the second attempt answers", async () => {
    await serve((response, attempt) => {
      if (attempt === 1) return void response.destroy(); // cut before any token
      for (const token of TOKENS) response.write(line({ token }));
      response.end(line({ usage: USAGE }));
    });

    const result = await askStreamed(HelloAgbossGatewayApplication, "Credit?", events);

    expect(gateway.requests).toHaveLength(2);
    expect(result.output).toEqual({ text: TOKENS.join("") });
    expect(result.spend.calls).toBe(1);
  }, 15_000);

  it("a failure after the first token is not retried: the call fails, the gateway is asked once", async () => {
    await serve(async (response) => {
      response.write(line({ token: TOKENS[0] }));
      await tick();
      response.destroy(); // the socket dies after text went out
    });

    const outcome = await askStreamed(HelloAgbossGatewayApplication, "Credit?", events).then(
      () => "finished",
      (error: unknown) => error,
    );

    expect(outcome).toBeInstanceOf(Error);
    expect(gateway.requests).toHaveLength(1); // never asked again: the text is out
    expect(events.some((event) => event.kind === "textDelta" && event.delta === TOKENS[0])).toBe(true);
  }, 15_000);
});
