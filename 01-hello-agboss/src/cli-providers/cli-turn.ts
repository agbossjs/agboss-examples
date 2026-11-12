import { ModelFailure, ModelProviderFailureError, ReasoningEffort } from "@agboss/core/models";
import type { ModelProviderRequest, ModelProviderResponse, ModelProviderUsage } from "@agboss/core/models";
import type { Clock } from "@agboss/core";
import { usd } from "@agboss/core/units";
import { childEnv } from "./child-env.js";
import { CliInvalidOutputError, CliSetupError } from "./errors.js";
import { runCli } from "./run-cli.js";
import type { Json } from "./strict-schema.js";
import { buildPrompt, envelopeSchema, readReply } from "./turn.js";

/** What a vendor's event reader found: the final reply (text, or the object a schema flag gave) and tokens. */
export interface Finding {
  readonly reply: unknown;
  readonly usage: ModelProviderUsage;
}

export interface VendorSpec {
  readonly name: string;
  /** Models `<prefix>/<id>` pick that CLI model; any other served name runs the CLI's default model. */
  readonly prefix: string;
  readonly binaryEnv: string;
  readonly defaultBinary: string;
  readonly extraEnv: readonly string[];
  readonly loginHint: string;
  /** No schema flag (Gemini): the schema goes in the prompt and the reply is parsed from text. */
  readonly inlineSchema: boolean;
  readonly prepare?: (dir: string) => Promise<void>;
  readonly args: (call: {
    readonly dir: string;
    readonly model: string | undefined;
    readonly schema: Json;
    readonly instructions: string;
    readonly effort: ReasoningEffort | undefined;
  }) => Promise<readonly string[]>;
  /** Claude gets the instructions as a system prompt flag; the others read everything on stdin. */
  readonly stdin: (parts: { readonly instructions: string; readonly body: string }) => string;
  /** A fresh reader per run. `onEvent` throws `CliNativeToolError` on any tool event of the CLI. */
  readonly reader: () => { onEvent: (event: unknown) => void; finding: () => Finding | undefined };
}

const MODEL_ID = /^[A-Za-z0-9._:-]{1,100}$/u;
const RATE_LIMITED = /rate.?limit|usage limit|quota|too many requests|\b429\b/iu;
const NOT_LOGGED_IN = /not logged in|log ?in required|please (log ?in|sign in)|unauthori[sz]ed|\b401\b|authenticat/iu;

function modelOf(spec: VendorSpec, model: string): string | undefined {
  if (!model.startsWith(`${spec.prefix}/`)) return undefined;
  const id = model.slice(spec.prefix.length + 1);
  if (id === "default") return undefined;
  if (!MODEL_ID.test(id)) throw new CliSetupError(`${spec.name}: "${id}" is not a model id`);
  return id;
}

function effortOf(spec: VendorSpec, request: ModelProviderRequest): ReasoningEffort | undefined {
  if (request.reasoning.kind !== "on") return undefined;
  if (request.reasoning.budget !== undefined) {
    throw new CliSetupError(`${spec.name}: a reasoning budget is not supported; it is never silently replaced`);
  }
  return request.reasoning.effort;
}

function failed(spec: VendorSpec, exitCode: number | null, stderr: string): Error {
  if (NOT_LOGGED_IN.test(stderr)) return new CliSetupError(`${spec.name} is not logged in: ${spec.loginHint}`);
  const failure = RATE_LIMITED.test(stderr) ? ModelFailure.RateLimited : ModelFailure.ServerError;
  // the pinned core's signature: (failure, { retryAfter?, cause? })
  return new ModelProviderFailureError(failure, {
    cause: new Error(`${spec.name} exited with ${String(exitCode)}: ${stderr}`),
  });
}

async function runOnce(
  spec: VendorSpec,
  request: ModelProviderRequest,
  clock: Clock,
  schema: Json,
  correction: string | undefined,
): Promise<{ readonly finding: Finding; readonly stderr: string }> {
  const reader = spec.reader();
  const prompt = buildPrompt(request, schema, spec.inlineSchema);
  const body = correction === undefined ? prompt.body : `${prompt.body}\n${correction}`;
  const binary = process.env[spec.binaryEnv] ?? spec.defaultBinary;
  const result = await runCli({
    binary,
    env: childEnv(process.env, spec.extraEnv),
    signal: request.signal,
    clock,
    onEvent: (event) => {
      reader.onEvent(event);
    },
    prepare: async (dir) => {
      await spec.prepare?.(dir);
      const args = await spec.args({
        dir,
        model: modelOf(spec, request.model),
        schema,
        instructions: prompt.instructions,
        effort: effortOf(spec, request),
      });
      return { args, stdin: spec.stdin({ instructions: prompt.instructions, body }) };
    },
  });
  const finding = reader.finding();
  if (result.exitCode !== 0 || finding === undefined) throw failed(spec, result.exitCode, result.stderr);
  return { finding, stderr: result.stderr };
}

const sumUsage = (a: ModelProviderUsage, b: ModelProviderUsage): ModelProviderUsage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
});

/** One model call = one CLI run (a second only when a prompt-parsed reply is not valid JSON). */
export async function completeViaCli(
  spec: VendorSpec,
  request: ModelProviderRequest,
  clock: Clock,
): Promise<ModelProviderResponse> {
  const schema = envelopeSchema(request.tools);
  const first = await runOnce(spec, request, clock, schema, undefined);
  try {
    return { ...readReply(first.finding.reply, request.tools), usage: first.finding.usage, cost: usd(0) };
  } catch (error) {
    if (!spec.inlineSchema || !(error instanceof CliInvalidOutputError)) throw error;
    const correction = `<agboss-correction>Your previous reply was not a valid JSON object for the schema: ${error.message}. Reply with only that JSON object.</agboss-correction>`;
    const second = await runOnce(spec, request, clock, schema, correction);
    return {
      ...readReply(second.finding.reply, request.tools),
      usage: sumUsage(first.finding.usage, second.finding.usage),
      cost: usd(0), // a plan is flat-priced: budgets count $0, tokens are still recorded
    };
  }
}
