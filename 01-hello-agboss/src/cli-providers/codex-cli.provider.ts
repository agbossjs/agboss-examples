import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { Clock, Logger } from "@agboss/core";
import { ModelProvider } from "@agboss/core/models";
import type { ModelProviderHandler, ModelProviderRequest, ModelProviderResponse } from "@agboss/core/models";
import { childEnv } from "./child-env.js";
import { completeViaCli, type VendorSpec } from "./cli-turn.js";
import { CliNativeToolError, CliSetupError } from "./errors.js";
import { CODEX_NOTICE, warn } from "./notice.js";
import { CLI_PROVIDER_POLICY } from "./provider-policy.js";
import { isJson } from "./strict-schema.js";

/** Codex's own tools, switched off. Only names `codex features list` reports are passed. */
const TOOL_FEATURES = [
  "shell_tool", "unified_exec", "unified_exec_tty", "view_image", "apps", "plugins", "remote_plugin",
  "multi_agent", "hooks", "browser_use", "browser_use_external", "computer_use", "image_generation",
  "sleep_tool", "code_mode_host", "goals", "tool_suggest", "skill_search", "in_app_browser",
];
const HARMLESS_ITEMS = new Set(["agent_message", "reasoning", "todo_list", "error"]);
const known = new Map<string, Promise<readonly string[]>>();
/** At least one of these must be in the listing: it proves the format is the one we understand. */
const LANDMARKS = ["shell_tool", "unified_exec"];

/** The feature names `codex features list` prints; anything we cannot read is a refusal to run. */
async function listFeatures(binary: string): Promise<readonly string[]> {
  let stdout: string;
  try {
    ({ stdout } = await promisify(execFile)(binary, ["features", "list"], {
      env: childEnv(process.env, ["CODEX_HOME"]),
    }));
  } catch (error) {
    throw new CliSetupError(`codex: \`codex features list\` failed (${String(error)}); cannot confirm its tools can be turned off`);
  }
  const names = stdout.split("\n").map((row) => row.trim().split(/\s+/u)[0] ?? "");
  if (!LANDMARKS.some((name) => names.includes(name))) {
    throw new CliSetupError("codex: the output of `codex features list` is not in a format we know; refusing to run with its tools possibly on");
  }
  return names;
}

/** A listing that fails the check is never cached: the next call asks again. */
function knownFeatures(binary: string): Promise<readonly string[]> {
  let listed = known.get(binary);
  if (listed === undefined) {
    listed = listFeatures(binary);
    known.set(binary, listed);
    listed.catch(() => known.delete(binary));
  }
  return listed;
}

const CODEX: VendorSpec = {
  name: "codex",
  prefix: "codex-cli",
  binaryEnv: "AGBOSS_CODEX_BINARY",
  defaultBinary: "codex",
  extraEnv: ["CODEX_HOME", "CODEX_CA_CERTIFICATE"],
  loginHint: "run `codex login`",
  inlineSchema: false,
  args: async ({ dir, model, schema, effort }) => {
    const listed = await knownFeatures(process.env[CODEX.binaryEnv] ?? CODEX.defaultBinary);
    const schemaPath = join(dir, "schema.json");
    await writeFile(schemaPath, JSON.stringify(schema));
    return [
      "exec", "--json", "--ephemeral", "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules",
      "--sandbox", "read-only", "--color", "never",
      ...TOOL_FEATURES.filter((name) => listed.includes(name)).flatMap((name) => ["--disable", name]),
      "-c", 'web_search="disabled"', "-c", "mcp_servers={}",
      "--output-schema", schemaPath,
      ...(model === undefined ? [] : ["-m", model]),
      ...(effort === undefined ? [] : ["-c", `model_reasoning_effort="${effort}"`]),
      "-",
    ];
  },
  stdin: ({ instructions, body }) => `${instructions}\n${body}`,
  reader: () => {
    let text: string | undefined;
    let usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };
    return {
      onEvent: (event) => {
        if (!isJson(event)) return;
        const type = String(event["type"]);
        const item = event["item"];
        if (type.startsWith("item.") && isJson(item)) {
          const kind = String(item["type"]);
          if (!HARMLESS_ITEMS.has(kind)) throw new CliNativeToolError(`${type}:${kind}`);
          if (kind === "agent_message" && typeof item["text"] === "string") text = item["text"];
        }
        if (type === "turn.completed" && isJson(event["usage"])) {
          const u = event["usage"];
          usage = {
            inputTokens: Number(u["input_tokens"] ?? 0),
            cacheReadTokens: Number(u["cached_input_tokens"] ?? 0),
            outputTokens: Number(u["output_tokens"] ?? 0) + Number(u["reasoning_output_tokens"] ?? 0),
          };
        }
      },
      finding: () => (text === undefined ? undefined : { reply: text, usage }),
    };
  },
};

/** `codex exec` on a ChatGPT login (OpenAI documents it). Demo / local use: see the startup warning. */
@ModelProvider({
  name: "codex-cli-model-provider",
  description: "Your own codex CLI (codex exec) on your own ChatGPT plan; demo / local only",
  // the example's agents say openai/gpt-4o-mini: in the CLI demo the CLI's default model answers
  serves: [/^codex-cli\//u, /^openai\//u],
  ...CLI_PROVIDER_POLICY,
  deps: [Logger, Clock],
})
export class CodexCliModelProvider implements ModelProviderHandler {
  constructor(
    logger: Logger,
    private readonly clock: Clock,
  ) {
    warn(logger, clock, CODEX_NOTICE);
  }

  complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
    return completeViaCli(CODEX, request, this.clock);
  }
}
