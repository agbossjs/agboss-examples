import type { ServerResponse } from "node:http";
import { ExecutionStatus, createApp, type ExecutionStreamEvent } from "@agboss/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HelloAgbossApplication } from "../../src/hello-agboss.application.js";
import { StreamingAnswerWorkflowStart } from "../../src/workflows/streaming-answer/streaming-answer.workflow-start.js";
import { askStreamed, Gate, startStub, textOf, tick, type Stub } from "./stub-server.js";

/** An OpenAI-compatible chunk with `delta`, as OpenRouter streams it. */
const chunk = (delta: Record<string, unknown>): string =>
  `data: ${JSON.stringify({ id: "gen-1", model: "openai/gpt-4o-mini", provider: "Acme", choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`;
const FINISH = `data: ${JSON.stringify({ id: "gen-1", model: "openai/gpt-4o-mini", provider: "Acme", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\n`;
/** The last chunk of a stream with `include_usage`: no choices, the usage and OpenRouter's cost. */
const USAGE_COST = 0.00042;
const USAGE = `data: ${JSON.stringify({ id: "gen-1", model: "openai/gpt-4o-mini", choices: [], usage: { prompt_tokens: 120, completion_tokens: 18, total_tokens: 138, cost: USAGE_COST } })}\n\n`;
const DONE = "data: [DONE]\n\n";

const TOKENS = ["Your", " invoice", " was", " credited."];

/** What OpenRouter lists: the startup check wants each used model to be listed. */
const MODELS = {
  data: [
    {
      id: "openai/gpt-4o-mini",
      supported_parameters: ["temperature", "max_tokens", "reasoning"],
      pricing: { prompt: "0.00000015", completion: "0.0000006" },
    },
  ],
};

describe("OpenRouterChatModelProvider streams the answer token by token (#1005)", () => {
  let openRouter: Stub;
  const events: ExecutionStreamEvent[] = [];

  beforeEach(() => {
    events.length = 0;
  });
  afterEach(async () => {
    delete process.env.OPENROUTER_BASE_URL;
    await openRouter.close();
  });

  /** A local OpenRouter on 127.0.0.1: its model list, and `chat` for each chat completion. */
  async function serve(chat: (response: ServerResponse, attempt: number) => Promise<void> | void) {
    let attempt = 0;
    openRouter = await startStub(async (request, response) => {
      if (request.method === "GET") {
        response.writeHead(200, { "content-type": "application/json" });
        return void response.end(JSON.stringify(MODELS));
      }
      attempt += 1;
      const streamed = request.body["stream"] === true;
      response.writeHead(200, { "content-type": streamed ? "text/event-stream" : "application/json" });
      await chat(response, attempt);
    });
    process.env.OPENROUTER_BASE_URL = `${openRouter.url}/api/v1`;
  }

  const completions = (): Stub["requests"] =>
    openRouter.requests.filter((request) => request.method === "POST");

  it("each token of the server-sent stream is a textDelta, before the answer is complete", async () => {
    const afterFirstToken = new Gate();
    await serve(async (response) => {
      response.write(chunk({ role: "assistant", content: "" }));
      response.write(chunk({ content: TOKENS[0] }));
      // the server holds the rest until the widget has the first token
      await afterFirstToken.opened;
      for (const token of TOKENS.slice(1)) {
        response.write(chunk({ content: token }));
        await tick();
      }
      response.end(FINISH + USAGE + DONE);
    });

    const result = await askStreamed(HelloAgbossApplication, "Credit?", events, (event) => {
      if (event.kind === "textDelta") afterFirstToken.open();
    });

    const deltas = events.flatMap((event) => (event.kind === "textDelta" ? [event.delta] : []));
    expect(deltas).toEqual(TOKENS);
    expect(result.status).toBe(ExecutionStatus.Finished);
    expect(result.output).toEqual({ text: TOKENS.join("") });
    expect(textOf(events)).toBe(TOKENS.join(""));
  }, 15_000);

  it("the call is a stream with include_usage, and the usage chunk's cost is the call's cost", async () => {
    await serve((response) => {
      response.write(chunk({ role: "assistant", content: "" }));
      for (const token of TOKENS) response.write(chunk({ content: token }));
      response.end(FINISH + USAGE + DONE);
    });

    const result = await askStreamed(HelloAgbossApplication, "Credit?", events);

    const [request] = completions();
    expect(request?.body).toMatchObject({ stream: true, stream_options: { include_usage: true } });
    expect(result.spend.calls).toBe(1);
    expect(result.spend.totalUsd).toBeCloseTo(USAGE_COST, 9);
    expect(result.spend.trace).toEqual([
      expect.objectContaining({
        inputTokens: 120,
        outputTokens: 18,
        costSource: "api",
        servedBy: "Acme",
      }),
    ]);
  });

  it("a run without onStream is a plain call: nothing is streamed", async () => {
    await serve((response) => {
      response.end(
        JSON.stringify({
          id: "gen-1",
          model: "openai/gpt-4o-mini",
          choices: [{ index: 0, message: { role: "assistant", content: "Credited." }, finish_reason: "stop" }],
          usage: { prompt_tokens: 12, completion_tokens: 2, total_tokens: 14, cost: 0.00001 },
        }),
      );
    });
    const app = await createApp(HelloAgbossApplication);
    try {
      const result = await app.execute(
        StreamingAnswerWorkflowStart,
        { text: "Credit?" },
        {
          ownerId: "user-stream-1",
          tenant: { tenantId: "tenant-acme", plan: "pro" },
          execution: { userId: "user-stream-1" },
        },
      );

      expect(result.output).toEqual({ text: "Credited." });
      expect(completions()[0]?.body["stream"]).not.toBe(true);
    } finally {
      await app.close();
    }
  });

  it("a stream cut after the first token is a failed attempt, not an answer, and is not retried", async () => {
    await serve(async (response) => {
      response.write(chunk({ content: TOKENS[0] }));
      await tick();
      response.destroy(); // no [DONE], no finish: the socket just dies
    });

    const outcome = await askStreamed(HelloAgbossApplication, "Credit?", events).then(
      () => "finished",
      (error: unknown) => error,
    );

    expect(outcome).toBeInstanceOf(Error);
    expect(completions()).toHaveLength(1); // the text was out: never asked again
    expect(events.some((event) => event.kind === "textDelta" && event.delta === TOKENS[0])).toBe(true);
  }, 15_000);

  it("a stream cut before the first token is a failed attempt too: nothing is shown, the run fails", async () => {
    await serve((response) => void response.destroy());

    const outcome = await askStreamed(HelloAgbossApplication, "Credit?", events).then(
      () => "finished",
      (error: unknown) => error,
    );

    expect(outcome).toBeInstanceOf(Error);
    expect(textOf(events)).toBe("");
  }, 15_000);

  it("a stream that ends without [DONE] or a finish is a failure too, never a short answer", async () => {
    await serve((response) => {
      response.end(chunk({ content: TOKENS[0] })); // a clean close, but the answer is not complete
    });

    const outcome = await askStreamed(HelloAgbossApplication, "Credit?", events).then(
      () => "finished",
      (error: unknown) => error,
    );

    expect(outcome).toBeInstanceOf(Error);
  }, 15_000);
});
