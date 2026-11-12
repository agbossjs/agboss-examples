import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Clock, Logger, type LogEntry } from "@agboss/core";
import { ModelProviderMessageRole, PromptCaching, Reasoning, type ModelProviderRequest } from "@agboss/core/models";
import type { Milliseconds } from "@agboss/core/units";

const HERE = dirname(fileURLToPath(import.meta.url));
export const fixture = (name: string): string => join(HERE, "fixtures", name);

export class RealClock extends Clock {
  override now(): Date {
    return new Date();
  }
  override sleep(delay: Milliseconds): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}

export class MemoryLogger extends Logger {
  readonly entries: LogEntry[] = [];
  override write(entry: LogEntry): void {
    this.entries.push(entry);
  }
}

export interface Call {
  readonly args: string[];
  readonly stdin: string;
  readonly schema?: string;
  readonly cwd: string;
  readonly env: string[];
  readonly files: string[];
  readonly startedAt?: number;
  readonly pid?: number;
  readonly grandchild?: number;
}

export interface FakeCli {
  readonly binary: string;
  readonly calls: () => Call[];
}

/** An executable that stands in for a vendor CLI: replays `replay` (fixtures, in order) in `mode`. */
export function fakeCli(replay: readonly string[], mode = "replay", orderLog?: string): FakeCli {
  const dir = mkdtempSync(join(tmpdir(), "fake-cli-"));
  const log = join(dir, "calls.jsonl");
  const binary = join(dir, "cli");
  const files = replay.map(fixture).join(",");
  writeFileSync(binary, `#!/bin/sh\nORDER_LOG="${orderLog ?? ""}" exec "${process.execPath}" "${join(HERE, "fake-cli.js")}" "${files}" ${mode} "${log}" "$@"\n`);
  chmodSync(binary, 0o755);
  return {
    binary,
    calls: () =>
      existsSync(log)
        ? readFileSync(log, "utf8").split("\n").filter(Boolean).map((row) => JSON.parse(row) as Call)
        : [],
  };
}

export const QUOTE_TOOL = {
  name: "calculate-quote",
  description: "Computes a quote",
  parameters: {
    type: "object",
    properties: { seats: { type: "number" }, tier: { type: "string", enum: ["basic", "pro"] } },
    required: ["seats", "tier"],
  },
};

export function request(over: Partial<ModelProviderRequest> = {}): ModelProviderRequest {
  return {
    model: "openai/gpt-4o-mini",
    messages: [
      { role: ModelProviderMessageRole.System, text: "You are a quote advisor <b>" },
      { role: ModelProviderMessageRole.User, text: "A quote for 12 seats & the pro tier?" },
    ],
    tools: [QUOTE_TOOL],
    temperature: 0,
    maxTokens: undefined,
    reasoning: Reasoning.modelDecides(),
    promptCaching: PromptCaching.off(),
    signal: new AbortController().signal,
    ...over,
  };
}
