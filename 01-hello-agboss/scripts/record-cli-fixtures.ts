/**
 * Records live fixtures for the Claude and Gemini CLI providers (agbossjs/agboss#963).
 *
 *   npx tsx scripts/record-cli-fixtures.ts claude|gemini [--raw-dir <dir>]
 *
 * It drives the REAL provider (the same flags, prompt and temp directory as a demo run) against the
 * maintainer's own installed CLI, under that CLI's own login, through a tee wrapper that keeps the CLI's
 * raw stdout and stderr. The raw files stay OUTSIDE the repository (default: a fresh temp directory) and
 * are never committed; the scrubbed copies go to tests/cli-providers/fixtures/<vendor>/live-<shape>.jsonl.
 * A recording that still holds an email, a home path or a session id after scrubbing is not written.
 *
 * A live run is the maintainer's call (vendor-terms risk): nothing runs it in CI or in the tests.
 * Calls are few and tiny: a plain answer, a tool-call turn, and an error (an unknown model).
 */
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Clock, Logger } from "@agboss/core";
import { PromptCaching, Reasoning, ModelProviderMessageRole } from "@agboss/core/models";
import type { ModelProviderRequest, ModelProviderResponse } from "@agboss/core/models";
import type { Milliseconds } from "@agboss/core/units";
import { claudeCliModelProvider } from "../src/cli-providers/claude-cli.provider.js";
import { geminiCliModelProvider } from "../src/cli-providers/gemini-cli.provider.js";
import { scrubLines } from "./scrub-fixture.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "..", "tests", "cli-providers", "fixtures");

class RealClock extends Clock {
  override now(): Date {
    return new Date();
  }
  override sleep(delay: Milliseconds): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
class QuietLogger extends Logger {
  override write(): void {
    /* the startup warning is the demo's job; a recording needs no log */
  }
}

const QUOTE_TOOL = {
  name: "calculate-quote",
  description: "Computes a quote",
  parameters: {
    type: "object",
    properties: { seats: { type: "number" }, tier: { type: "string", enum: ["basic", "pro"] } },
    required: ["seats", "tier"],
  },
};

const ask = (vendor: string, text: string, over: Partial<ModelProviderRequest> = {}): ModelProviderRequest => ({
  model: `${vendor}-cli/default`,
  messages: [
    { role: ModelProviderMessageRole.System, text: "You are a quote advisor." },
    { role: ModelProviderMessageRole.User, text },
  ],
  tools: [],
  temperature: 0,
  maxTokens: undefined,
  reasoning: Reasoning.modelDecides(),
  promptCaching: PromptCaching.off(),
  signal: new AbortController().signal,
  ...over,
});

const shapes = (vendor: string, cheapModel: string): readonly { name: string; request: ModelProviderRequest }[] => [
  { name: "text", request: ask(vendor, "Reply with the single word: ok", { model: `${vendor}-cli/${cheapModel}` }) },
  {
    name: "tool-call",
    request: ask(vendor, "A quote for 12 seats on the pro tier, please.", {
      model: `${vendor}-cli/${cheapModel}`,
      tools: [QUOTE_TOOL],
    }),
  },
  { name: "error", request: ask(vendor, "Reply with the single word: ok", { model: `${vendor}-cli/no-such-model-963` }) },
];

async function main(): Promise<void> {
  const [vendor, ...rest] = process.argv.slice(2);
  if (vendor !== "claude" && vendor !== "gemini") throw new Error("usage: record-cli-fixtures.ts claude|gemini [--raw-dir <dir>]");
  const rawAt = rest.indexOf("--raw-dir");
  const rawDir = rawAt >= 0 ? (rest[rawAt + 1] ?? "") : mkdtempSync(join(tmpdir(), `963-raw-${vendor}-`));
  mkdirSync(rawDir, { recursive: true });
  const real = process.env[vendor === "claude" ? "AGBOSS_CLAUDE_BINARY" : "AGBOSS_GEMINI_BINARY"] ?? vendor;
  const wrapper = join(rawDir, "tee-cli.sh");
  // keeps the CLI's stdout and stderr, hands both on unchanged, and returns the CLI's own exit code
  writeFileSync(
    wrapper,
    `#!/bin/sh\nn=$(ls "${rawDir}" | grep -c '^call-.*\\.out$')\n"${real}" "$@" 2>"${rawDir}/call-$n.err" >"${rawDir}/call-$n.out"\ncode=$?\ncat "${rawDir}/call-$n.out"\ncat "${rawDir}/call-$n.err" >&2\nexit $code\n`,
  );
  chmodSync(wrapper, 0o755);
  process.env[vendor === "claude" ? "AGBOSS_CLAUDE_BINARY" : "AGBOSS_GEMINI_BINARY"] = wrapper;

  const Provider: new (logger: Logger, clock: Clock) => { complete(request: ModelProviderRequest): Promise<ModelProviderResponse> } =
    vendor === "claude"
      ? claudeCliModelProvider({ acknowledgeVendorTermsRisk: true })
      : geminiCliModelProvider({ acknowledgeVendorTermsRisk: true });
  const provider = new Provider(new QuietLogger(), new RealClock());
  const outDir = join(FIXTURES, vendor);

  for (const shape of shapes(vendor, vendor === "claude" ? "haiku" : "gemini-2.5-flash-lite")) {
    const before = readdirCount(rawDir);
    let outcome: string;
    try {
      const response = await provider.complete(shape.request);
      outcome = `ok text=${JSON.stringify(response.text).slice(0, 80)} toolCalls=${String(response.toolCalls?.length ?? 0)}`;
    } catch (error) {
      outcome = `threw ${error instanceof Error ? `${error.name}: ${error.message.slice(0, 200)}` : "?"}`;
    }
    const raw = readFileSync(join(rawDir, `call-${String(before)}.out`), "utf8");
    console.log(`${shape.name}: ${outcome}; raw ${String(raw.split("\n").filter(Boolean).length)} lines in ${rawDir}`);
    if (rest.includes("--no-write")) continue;
    // an unscrubbable recording throws here: nothing is written
    writeFileSync(join(outDir, `live-${shape.name}.jsonl`), scrubLines(raw));
  }
}

const readdirCount = (dir: string): number => {
  let n = 0;
  while (existsRaw(dir, n)) n++;
  return n;
};
const existsRaw = (dir: string, n: number): boolean => {
  try {
    readFileSync(join(dir, `call-${String(n)}.out`));
    return true;
  } catch {
    return false;
  }
};

await main();
