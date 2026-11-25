import { ApplicationContext } from "@agboss/core";
import {
  CircuitBreakerPolicy,
  ModelCost,
  ModelFailure,
  ModelProvider,
  ModelProviderFailureError,
  PromptCaching,
  Reasoning,
  RetryPolicy,
  TRANSIENT_FAILURES,
  type ModelProviderHandler,
  type ModelProviderRequest,
  type ModelProviderResponse,
  type ModelProviderStream,
  type ModelProviderStreamResult,
  type TokenUsage,
} from "@agboss/core/models";
import { minutes, seconds, usd } from "@agboss/core/units";

/** What the company's LLM gateway sends per line of its `/stream` answer: a token, then the usage. */
interface GatewayLine {
  readonly token?: string;
  readonly usage?: TokenUsage;
}

/** A 429 and a 5xx are failures the retry policy may retry; any other status is not retried. */
function failureOfStatus(status: number): Error {
  if (status === 429) return new ModelProviderFailureError({ failure: ModelFailure.RateLimited });
  if (status >= 500) return new ModelProviderFailureError({ failure: ModelFailure.ServerError });
  return new Error(`the gateway refused the call: HTTP ${String(status)}`);
}

/** A dead socket is a `NetworkError` of the gateway; our own failures and the caller's abort stay as they are. */
function networkFailureOf(error: unknown, signal: AbortSignal): unknown {
  if (error instanceof ModelProviderFailureError || signal.aborted) return error;
  return new ModelProviderFailureError({ failure: ModelFailure.NetworkError, cause: error });
}

/** The lines of an NDJSON body, each as soon as its newline arrives. */
async function* linesOf(body: ReadableStream<Uint8Array>): AsyncGenerator<GatewayLine> {
  const decoder = new TextDecoder();
  let pending = "";
  for await (const part of body) {
    pending += decoder.decode(part, { stream: true });
    let end = pending.indexOf("\n");
    while (end >= 0) {
      const line = pending.slice(0, end).trim();
      pending = pending.slice(end + 1);
      if (line !== "") yield JSON.parse(line) as GatewayLine;
      end = pending.indexOf("\n");
    }
  }
}

/**
 * A corporate LLM gateway that is not an OpenAI-compatible server: a transport provider
 * (`complete()`), which also streams (`stream()`, #1011) — the gateway's `/stream` answers one JSON
 * line per token and a last line with the usage, and every token is a `textDelta` of `onStream` as
 * its line arrives. The gateway's address is the environment's `gatewayBaseUrl`.
 */
@ModelProvider({
  name: "gateway-stream-model-provider",
  description: "The company LLM gateway: complete() and a token-by-token stream()",
  timeout: minutes(1),
  cost: ModelCost.fromPrices({
    "openai/gpt-4o-mini": { inputPerMillion: usd(0.15), outputPerMillion: usd(0.6) },
  }),
  reasoning: Reasoning.off(),
  promptCaching: PromptCaching.off(),
  // a failure before the first token is retried; one after text is not (the text is out)
  retryPolicy: RetryPolicy.exponential({
    maxAttempts: 3,
    initialDelay: seconds(1),
    maxDelay: seconds(2),
    jitter: false,
    // a socket that dies is a NetworkError, which TRANSIENT_FAILURES does not list: this provider opts in
    retryOn: [...TRANSIENT_FAILURES, ModelFailure.NetworkError],
  }),
  circuitBreakerPolicy: CircuitBreakerPolicy.fixed({
    failureThreshold: 5,
    failureWindow: minutes(1),
    openDuration: seconds(30),
  }),
  deps: [ApplicationContext],
})
export class GatewayStreamModelProvider implements ModelProviderHandler {
  constructor(private readonly applicationContext: ApplicationContext) {}

  async complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    const stream = this.stream(request);
    let text = "";
    for await (const token of stream.textStream) text += token;
    return { text, usage: (await stream.result).usage };
  }

  stream(request: ModelProviderRequest): ModelProviderStream {
    let settle: {
      resolve(result: ModelProviderStreamResult): void;
      reject(error: unknown): void;
    } = {
      resolve: () => undefined,
      reject: () => undefined,
    };
    const result = new Promise<ModelProviderStreamResult>((resolve, reject) => {
      settle = { resolve, reject };
    });
    result.catch(() => undefined); // the stream's own error reaches the gateway through textStream
    const baseUrl = this.applicationContext.environment.gatewayBaseUrl;
    const textStream = async function* (): AsyncGenerator<string> {
      try {
        if (baseUrl === undefined) throw new Error("the environment has no gatewayBaseUrl");
        const response = await fetch(`${baseUrl}/stream`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: request.model, messages: request.messages }),
          signal: request.signal,
        });
        if (!response.ok || response.body === null) {
          throw failureOfStatus(response.status);
        }
        let used: TokenUsage | undefined;
        for await (const line of linesOf(response.body)) {
          if (line.usage !== undefined) used = line.usage;
          if (line.token !== undefined) yield line.token;
        }
        // a body that ends without its usage line was cut
        if (used === undefined) {
          throw new ModelProviderFailureError({ failure: ModelFailure.NetworkError });
        }
        settle.resolve({ usage: used });
      } catch (error) {
        const failure = networkFailureOf(error, request.signal);
        settle.reject(failure);
        throw failure;
      }
    };
    return { textStream: textStream(), result };
  }
}
