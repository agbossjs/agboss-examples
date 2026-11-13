import { Clock, Logger } from "@agboss/core";
import { ModelProvider } from "@agboss/core/models";
import type { ModelProviderHandler, ModelProviderRequest, ModelProviderResponse } from "@agboss/core/models";
import { completeViaCli, type VendorSpec } from "./cli-turn.js";
import { CliNativeToolError, RiskNotAcknowledgedError } from "./errors.js";
import { CLAUDE_NOTICE, warn } from "./notice.js";
import { CLI_PROVIDER_POLICY } from "./provider-policy.js";
import { isJson } from "./strict-schema.js";

/** The tool the CLI itself uses to hand back `--json-schema` output: not a tool of the model's. */
const STRUCTURED_OUTPUT_TOOL = "StructuredOutput";

const CLAUDE: VendorSpec = {
  name: "claude",
  prefix: "claude-cli",
  binaryEnv: "AGBOSS_CLAUDE_BINARY",
  defaultBinary: "claude",
  extraEnv: ["CLAUDE_CONFIG_DIR"],
  loginHint: "run `claude auth login`",
  inlineSchema: false,
  // no --bare: bare mode never reads the subscription login
  args: ({ schema, instructions, model }) =>
    Promise.resolve([
      "-p", "--output-format", "stream-json", "--verbose", "--json-schema", JSON.stringify(schema),
      "--safe-mode", "--tools", "", "--disallowedTools", "mcp__*",
      "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
      "--disable-slash-commands", "--no-session-persistence",
      "--permission-mode", "dontAsk", "--permission-prompts", "none",
      "--system-prompt", instructions,
      ...(model === undefined ? [] : ["--model", model]),
    ]),
  stdin: ({ body }) => body,
  reader: () => {
    let result: Record<string, unknown> | undefined;
    let toolsOff = false; // the init event listed no tool: the CLI itself confirms they are off
    return {
      onEvent: (event) => {
        if (!isJson(event)) return;
        const message = event["message"];
        if (event["type"] === "assistant" && isJson(message) && Array.isArray(message["content"])) {
          for (const block of message["content"] as unknown[]) {
            if (isJson(block) && block["type"] === "tool_use" && block["name"] !== STRUCTURED_OUTPUT_TOOL) {
              throw new CliNativeToolError(`tool_use:${String(block["name"])}`);
            }
          }
        }
        if (event["type"] === "system" && event["subtype"] === "init" && Array.isArray(event["tools"])) {
          // exactly the structured-output tool may be listed (Claude docs), by its known name
          const others = event["tools"].filter((tool) => tool !== STRUCTURED_OUTPUT_TOOL);
          if (others.length > 0) throw new CliNativeToolError("init:tools-listed");
          toolsOff = true;
        }
        if (event["type"] === "result") result = event;
      },
      finding: () => {
        // fail closed: no confirmation that the tools are off, no answer
        if (!toolsOff || result === undefined || result["is_error"] === true) return undefined;
        const u = isJson(result["usage"]) ? result["usage"] : {};
        const read = Number(u["cache_read_input_tokens"] ?? 0);
        const write = Number(u["cache_creation_input_tokens"] ?? 0);
        return {
          reply: result["structured_output"] ?? result["result"],
          usage: {
            inputTokens: Number(u["input_tokens"] ?? 0) + read + write,
            cacheReadTokens: read,
            cacheWriteTokens: write,
            outputTokens: Number(u["output_tokens"] ?? 0), // total_cost_usd is an API-price estimate: ignored
          },
        };
      },
    };
  },
};

/**
 * `claude -p` on a Claude plan. Anthropic's terms prohibit this for third-party products (see the
 * startup warning): it is made only with `acknowledgeVendorTermsRisk: true`, a compile error without.
 */
export function claudeCliModelProvider(options: { readonly acknowledgeVendorTermsRisk: true }) {
  const acknowledged: unknown = options.acknowledgeVendorTermsRisk; // plain JavaScript may leave it out
  if (acknowledged !== true) throw new RiskNotAcknowledgedError("claude-cli");

  @ModelProvider({
    name: "claude-cli-model-provider",
    description: "Your own claude CLI (claude -p) on your own plan; demo / local only, terms risk acknowledged",
    serves: [/^claude-cli\//u, /^openai\//u],
    ...CLI_PROVIDER_POLICY,
    deps: [Logger, Clock],
  })
  class ClaudeCliModelProvider implements ModelProviderHandler {
    constructor(
    logger: Logger,
    private readonly clock: Clock,
  ) {
      warn(logger, clock, CLAUDE_NOTICE);
    }

    complete(request: ModelProviderRequest): Promise<ModelProviderResponse> {
      return completeViaCli(CLAUDE, request, this.clock);
    }
  }
  return ClaudeCliModelProvider;
}
